# 小程序流式传输代理服务

## 功能说明

这个代理服务解决了小程序无法真正实现流式传输的问题，通过以下方式：

1. **接收小程序请求**：小程序发送消息到代理服务
2. **转发到n8n**：代理服务将请求转发到你的n8n工作流
3. **处理流式响应**：代理服务接收n8n的流式数据并解析
4. **分块存储**：将流式数据分块存储在内存中
5. **轮询接口**：小程序通过轮询获取实时数据块

## 部署步骤

### 1. 安装依赖
```bash
cd streaming-proxy
npm install
```

### 2. 启动服务
```bash
# 开发环境
npm run dev

# 生产环境
npm start
```

### 3. 部署到服务器
推荐部署到：
- Vercel
- Railway
- 阿里云/腾讯云服务器
- Docker容器

### 4. 配置域名
部署后获得域名，例如：`https://your-proxy.vercel.app`

### 5. 更新小程序配置
在小程序代码中将 `https://your-proxy-domain.com` 替换为实际的代理服务域名

## API接口

### 启动流式请求
```
POST /api/stream/start
Content-Type: application/json

{
  "message": "用户消息",
  "session_id": "用户会话ID"
}

Response:
{
  "streamId": "uuid"
}
```

### 获取流式数据
```
GET /api/stream/{streamId}?from=0

Response:
{
  "chunks": [
    {
      "type": "begin|item|end",
      "content": "内容",
      "timestamp": 1234567890
    }
  ],
  "completed": false,
  "totalChunks": 10
}
```

## 优势

1. **真正的流式传输**：实时接收和转发数据
2. **低延迟**：100ms轮询间隔，接近实时
3. **可靠性**：错误处理和自动清理
4. **扩展性**：可以处理多个并发流式请求

## 注意事项

1. 确保代理服务域名在小程序的合法域名列表中
2. 生产环境建议使用HTTPS
3. 可以根据需要调整轮询间隔和缓存时间