const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

const app = express();
const port = process.env.PORT || 3001;

// 存储流式数据的内存缓存
const streamCache = new Map();

app.use(cors());
app.use(express.json());

// 根路径测试
app.get('/', (req, res) => {
  res.json({
    message: '流式代理服务运行正常',
    timestamp: new Date().toISOString(),
    endpoints: [
      'POST /api/stream/start',
      'GET /api/stream/:streamId'
    ]
  });
});

// 启动流式请求
app.post('/api/stream/start', async (req, res) => {
  const { message, session_id } = req.body;
  const streamId = uuidv4();

  console.log(`[Proxy] 启动流式请求 ${streamId}:`, { message, session_id });

  // 初始化流式数据存储
  streamCache.set(streamId, {
    chunks: [],
    completed: false,
    error: null,
    startTime: Date.now()
  });

  // 异步处理流式请求
  processStreamingRequest(streamId, message, session_id);

  res.json({ streamId });
});

// 获取流式数据块
app.get('/api/stream/:streamId', (req, res) => {
  const { streamId } = req.params;
  const { from = 0 } = req.query;

  const streamData = streamCache.get(streamId);

  if (!streamData) {
    return res.status(404).json({ error: 'Stream not found' });
  }

  if (streamData.error) {
    return res.status(500).json({ error: streamData.error });
  }

  const fromIndex = parseInt(from);
  const newChunks = streamData.chunks.slice(fromIndex);

  res.json({
    chunks: newChunks,
    completed: streamData.completed,
    totalChunks: streamData.chunks.length
  });
});

// 处理流式请求
async function processStreamingRequest(streamId, message, sessionId) {
  const streamData = streamCache.get(streamId);

  try {
    console.log(`[Proxy] 向n8n发送请求:`, {
      url: 'https://xmtj.xyz/webhook/ai',
      data: { message, session_id: sessionId }
    });

    const response = await axios({
      method: 'POST',
      url: 'https://xmtj.xyz/webhook/ai',
      data: { message, session_id: sessionId },
      headers: {
        'Content-Type': 'application/json'
      },
      responseType: 'stream'
    });

    let buffer = '';

    response.data.on('data', (chunk) => {
      const chunkStr = chunk.toString();
      buffer += chunkStr;

      console.log(`[Proxy] 接收到数据块:`, chunkStr.substring(0, 100) + '...');

      // 解析JSON流
      parseAndStoreChunks(streamId, buffer);
    });

    response.data.on('end', () => {
      console.log(`[Proxy] 流式请求完成: ${streamId}`);
      streamData.completed = true;

      // 清理过期数据（5分钟后）
      setTimeout(() => {
        streamCache.delete(streamId);
        console.log(`[Proxy] 清理过期流数据: ${streamId}`);
      }, 5 * 60 * 1000);
    });

    response.data.on('error', (error) => {
      console.error(`[Proxy] 流式请求错误: ${streamId}`, error);
      streamData.error = error.message;
    });

  } catch (error) {
    console.error(`[Proxy] 请求失败: ${streamId}`, error);
    streamData.error = error.message;
  }
}

// 解析并存储数据块
function parseAndStoreChunks(streamId, buffer) {
  const streamData = streamCache.get(streamId);
  if (!streamData) return;

  // 解析JSON流
  let startIndex = 0;
  let braceCount = 0;
  let inString = false;
  let escapeNext = false;

  for (let i = 0; i < buffer.length; i++) {
    const char = buffer[i];

    if (escapeNext) {
      escapeNext = false;
      continue;
    }

    if (char === '\\') {
      escapeNext = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (!inString) {
      if (char === '{') {
        if (braceCount === 0) {
          startIndex = i;
        }
        braceCount++;
      } else if (char === '}') {
        braceCount--;
        if (braceCount === 0) {
          const jsonStr = buffer.substring(startIndex, i + 1);
          try {
            const jsonData = JSON.parse(jsonStr);

            // 存储有效的数据块
            if (jsonData.type === 'begin' ||
              (jsonData.type === 'item' && jsonData.content) ||
              jsonData.type === 'end') {

              streamData.chunks.push({
                type: jsonData.type,
                content: jsonData.content || '',
                timestamp: Date.now()
              });

              console.log(`[Proxy] 存储数据块:`, jsonData.type, jsonData.content?.substring(0, 20));
            }
          } catch (e) {
            console.error(`[Proxy] JSON解析失败:`, e.message);
          }
        }
      }
    }
  }
}

// Vercel 无服务器函数导出
module.exports = app;

// 本地开发时启动服务器
if (require.main === module) {
  app.listen(port, () => {
    console.log(`[Proxy] 流式代理服务启动在端口 ${port}`);
  });
}
