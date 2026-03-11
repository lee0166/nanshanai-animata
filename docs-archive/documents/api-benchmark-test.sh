#!/bin/bash
# API 基准测试脚本
# 用于测试 LLM API 的直接响应时间
#
# 使用方法:
# 1. 填写你的 API Key
# 2. 运行: bash api-benchmark-test.sh

# ============================================
# 配置区域 - 请填写你的实际 API Key
# ============================================

# 火山引擎 API (Doubao/DeepSeek)
VOLCENGINE_API_KEY="your-volcengine-api-key"
VOLCENGINE_API_URL="https://ark.cn-beijing.volces.com/api/v3"

# DeepSeek API
DEEPSEEK_API_KEY="your-deepseek-api-key"
DEEPSEEK_API_URL="https://api.deepseek.com"

# 测试用的短文本 (与日志中的339字符文本类似)
TEST_CONTENT="大靖沈家遭丞相诬陷满门抄斩，幼子沈清辞被救隐民间。十年后化名苏砚入吏部，凭断案能力获赏识，遭丞相之子萧景渊嫉恨构陷。沈清辞暗中搜集丞相罪证，发现当年冤案真相，更察觉丞相欲谋朝篡位。萧景渊察觉其身份，多次设计欲除之而后快。沈清辞在危机中得皇帝信任，步步为营，终将丞相罪行公之于众，为沈家昭雪。"

echo "=========================================="
echo "API 基准测试 - 短文本响应时间"
echo "测试内容长度: ${#TEST_CONTENT} 字符"
echo "=========================================="
echo ""

# ============================================
# 测试 1: 火山引擎 - 简单文本生成
# ============================================
echo "测试 1: 火山引擎 API - 简单文本生成"
echo "------------------------------------------"

curl -w "
---
HTTP Code: %{http_code}
Total Time: %{time_total}s
DNS Lookup: %{time_namelookup}s
TCP Connect: %{time_connect}s
TLS Handshake: %{time_appconnect}s
Time to First Byte: %{time_starttransfer}s
" \
  -o /dev/null \
  -s \
  -X POST "${VOLCENGINE_API_URL}/chat/completions" \
  -H "Authorization: Bearer ${VOLCENGINE_API_KEY}" \
  -H "Content-Type: application/json" \
  -d "{
    \"model\": \"doubao-pro-32k-241215\",
    \"messages\": [
      {\"role\": \"system\", \"content\": \"你是一个专业的剧本分析助手。\"},
      {\"role\": \"user\", \"content\": \"请分析以下剧本的故事核心，100字以内：${TEST_CONTENT}\"}
    ],
    \"temperature\": 0.3,
    \"max_tokens\": 500
  }"

echo ""
echo ""

# ============================================
# 测试 2: 火山引擎 - 结构化输出 (JSON Mode)
# ============================================
echo "测试 2: 火山引擎 API - 结构化输出 (JSON Mode)"
echo "------------------------------------------"

curl -w "
---
HTTP Code: %{http_code}
Total Time: %{time_total}s
DNS Lookup: %{time_namelookup}s
TCP Connect: %{time_connect}s
TLS Handshake: %{time_appconnect}s
Time to First Byte: %{time_starttransfer}s
" \
  -o /dev/null \
  -s \
  -X POST "${VOLCENGINE_API_URL}/chat/completions" \
  -H "Authorization: Bearer ${VOLCENGINE_API_KEY}" \
  -H "Content-Type: application/json" \
  -d "{
    \"model\": \"doubao-pro-32k-241215\",
    \"messages\": [
      {\"role\": \"system\", \"content\": \"你是一个专业的剧本分析助手。请严格按照JSON格式输出。\"},
      {\"role\": \"user\", \"content\": \"请分析以下剧本的视觉风格，以JSON格式返回：artDirection, artStyle, colorPalette, colorMood, cinematography, lightingStyle。剧本内容：${TEST_CONTENT}\"}
    ],
    \"temperature\": 0.3,
    \"max_tokens\": 1000,
    \"response_format\": {\"type\": \"json_object\"}
  }"

echo ""
echo ""

# ============================================
# 测试 3: DeepSeek API - 简单文本生成
# ============================================
echo "测试 3: DeepSeek API - 简单文本生成"
echo "------------------------------------------"

curl -w "
---
HTTP Code: %{http_code}
Total Time: %{time_total}s
DNS Lookup: %{time_namelookup}s
TCP Connect: %{time_connect}s
TLS Handshake: %{time_appconnect}s
Time to First Byte: %{time_starttransfer}s
" \
  -o /dev/null \
  -s \
  -X POST "${DEEPSEEK_API_URL}/chat/completions" \
  -H "Authorization: Bearer ${DEEPSEEK_API_KEY}" \
  -H "Content-Type: application/json" \
  -d "{
    \"model\": \"deepseek-chat\",
    \"messages\": [
      {\"role\": \"system\", \"content\": \"你是一个专业的剧本分析助手。\"},
      {\"role\": \"user\", \"content\": \"请分析以下剧本的故事核心，100字以内：${TEST_CONTENT}\"}
    ],
    \"temperature\": 0.3,
    \"max_tokens\": 500
  }"

echo ""
echo ""

# ============================================
# 测试 4: 火山引擎 - 元数据提取 (完整Prompt)
# ============================================
echo "测试 4: 火山引擎 API - 元数据提取 (完整Prompt)"
echo "------------------------------------------"

METADATA_PROMPT="请快速分析以下剧本/小说内容，提取基础元数据：

【剧本内容】
${TEST_CONTENT}

请提取：
1. 作品标题
2. 总字数
3. 预估时长
4. 主要角色数量
5. 主要角色名称列表
6. 主要场景数量
7. 主要场景名称列表
8. 章节/幕数
9. 故事类型
10. 整体基调

请严格按以下JSON格式输出：
{\"title\": \"\", \"wordCount\": 0, \"estimatedDuration\": \"\", \"characterCount\": 0, \"characterNames\": [], \"sceneCount\": 0, \"sceneNames\": [], \"chapterCount\": 0, \"genre\": \"\", \"tone\": \"\"}"

curl -w "
---
HTTP Code: %{http_code}
Total Time: %{time_total}s
DNS Lookup: %{time_namelookup}s
TCP Connect: %{time_connect}s
TLS Handshake: %{time_appconnect}s
Time to First Byte: %{time_starttransfer}s
" \
  -o /dev/null \
  -s \
  -X POST "${VOLCENGINE_API_URL}/chat/completions" \
  -H "Authorization: Bearer ${VOLCENGINE_API_KEY}" \
  -H "Content-Type: application/json" \
  -d "{
    \"model\": \"doubao-pro-32k-241215\",
    \"messages\": [
      {\"role\": \"system\", \"content\": \"你是一个专业的剧本分析助手，擅长从小说/剧本中提取结构化信息。请严格按照要求的JSON格式输出。\"},
      {\"role\": \"user\", \"content\": \"${METADATA_PROMPT}\"}
    ],
    \"temperature\": 0.3,
    \"max_tokens\": 2000,
    \"response_format\": {\"type\": \"json_object\"}
  }"

echo ""
echo ""

# ============================================
# 测试 5: 并发测试 - 3个并行请求
# ============================================
echo "测试 5: 火山引擎 API - 3个并行请求"
echo "------------------------------------------"
echo "模拟 GlobalContextExtractor 的并行提取..."

START_TIME=$(date +%s%N)

# 启动3个并行请求
for i in 1 2 3; do
  (
    curl -w "
Request $i - Total Time: %{time_total}s
" \
      -o /dev/null \
      -s \
      -X POST "${VOLCENGINE_API_URL}/chat/completions" \
      -H "Authorization: Bearer ${VOLCENGINE_API_KEY}" \
      -H "Content-Type: application/json" \
      -d "{
        \"model\": \"doubao-pro-32k-241215\",
        \"messages\": [
          {\"role\": \"system\", \"content\": \"你是一个专业的剧本分析助手。\"},
          {\"role\": \"user\", \"content\": \"任务${i}：请分析以下剧本的某个方面，100字以内：${TEST_CONTENT}\"}
        ],
        \"temperature\": 0.3,
        \"max_tokens\": 500
      }"
  ) &
done

# 等待所有后台任务完成
wait

END_TIME=$(date +%s%N)
TOTAL_TIME=$(( (END_TIME - START_TIME) / 1000000 ))  # 转换为毫秒

echo ""
echo "3个并行请求总耗时: ${TOTAL_TIME}ms"
echo ""

echo "=========================================="
echo "测试完成"
echo "=========================================="
