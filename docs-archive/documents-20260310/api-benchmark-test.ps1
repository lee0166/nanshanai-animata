# API 基准测试脚本 (PowerShell)
# 用于测试 LLM API 的直接响应时间
#
# 使用方法:
# 1. 填写你的 API Key
# 2. 运行: .\api-benchmark-test.ps1

# ============================================
# 配置区域 - 请填写你的实际 API Key
# ============================================

# 火山引擎 API (Doubao/DeepSeek)
$VOLCENGINE_API_KEY = "your-volcengine-api-key"
$VOLCENGINE_API_URL = "https://ark.cn-beijing.volces.com/api/v3"

# DeepSeek API
$DEEPSEEK_API_KEY = "your-deepseek-api-key"
$DEEPSEEK_API_URL = "https://api.deepseek.com"

# 测试用的短文本 (与日志中的339字符文本类似)
$TEST_CONTENT = "大靖沈家遭丞相诬陷满门抄斩，幼子沈清辞被救隐民间。十年后化名苏砚入吏部，凭断案能力获赏识，遭丞相之子萧景渊嫉恨构陷。沈清辞暗中搜集丞相罪证，发现当年冤案真相，更察觉丞相欲谋朝篡位。萧景渊察觉其身份，多次设计欲除之而后快。沈清辞在危机中得皇帝信任，步步为营，终将丞相罪行公之于众，为沈家昭雪。"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "API 基准测试 - 短文本响应时间" -ForegroundColor Cyan
Write-Host "测试内容长度: $($TEST_CONTENT.Length) 字符" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# 辅助函数: 测量 API 调用时间
function Measure-ApiCall {
    param(
        [string]$Name,
        [string]$Url,
        [string]$ApiKey,
        [string]$Body
    )

    Write-Host "测试: $Name" -ForegroundColor Yellow
    Write-Host "------------------------------------------"

    $headers = @{
        "Authorization" = "Bearer $ApiKey"
        "Content-Type" = "application/json"
    }

    $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
    $startTime = Get-Date

    try {
        $response = Invoke-RestMethod -Uri $Url -Method POST -Headers $headers -Body $Body -TimeoutSec 120
        $stopwatch.Stop()

        Write-Host "✓ 成功" -ForegroundColor Green
        Write-Host "  总耗时: $($stopwatch.ElapsedMilliseconds) ms" -ForegroundColor Green
        Write-Host "  开始时间: $startTime" -ForegroundColor Gray
        Write-Host "  结束时间: $(Get-Date)" -ForegroundColor Gray

        return @{
            Success = $true
            Duration = $stopwatch.ElapsedMilliseconds
            Response = $response
        }
    }
    catch {
        $stopwatch.Stop()
        Write-Host "✗ 失败: $($_.Exception.Message)" -ForegroundColor Red
        Write-Host "  耗时: $($stopwatch.ElapsedMilliseconds) ms" -ForegroundColor Red

        return @{
            Success = $false
            Duration = $stopwatch.ElapsedMilliseconds
            Error = $_.Exception.Message
        }
    }
}

# ============================================
# 测试 1: 火山引擎 - 简单文本生成
# ============================================
$body1 = @{
    model = "doubao-pro-32k-241215"
    messages = @(
        @{ role = "system"; content = "你是一个专业的剧本分析助手。" }
        @{ role = "user"; content = "请分析以下剧本的故事核心，100字以内：$TEST_CONTENT" }
    )
    temperature = 0.3
    max_tokens = 500
} | ConvertTo-Json -Depth 10

$result1 = Measure-ApiCall -Name "火山引擎 API - 简单文本生成" -Url "$VOLCENGINE_API_URL/chat/completions" -ApiKey $VOLCENGINE_API_KEY -Body $body1
Write-Host ""

# ============================================
# 测试 2: 火山引擎 - 结构化输出 (JSON Mode)
# ============================================
$body2 = @{
    model = "doubao-pro-32k-241215"
    messages = @(
        @{ role = "system"; content = "你是一个专业的剧本分析助手。请严格按照JSON格式输出。" }
        @{ role = "user"; content = "请分析以下剧本的视觉风格，以JSON格式返回：artDirection, artStyle, colorPalette, colorMood, cinematography, lightingStyle。剧本内容：$TEST_CONTENT" }
    )
    temperature = 0.3
    max_tokens = 1000
    response_format = @{ type = "json_object" }
} | ConvertTo-Json -Depth 10

$result2 = Measure-ApiCall -Name "火山引擎 API - 结构化输出 (JSON Mode)" -Url "$VOLCENGINE_API_URL/chat/completions" -ApiKey $VOLCENGINE_API_KEY -Body $body2
Write-Host ""

# ============================================
# 测试 3: DeepSeek API - 简单文本生成
# ============================================
$body3 = @{
    model = "deepseek-chat"
    messages = @(
        @{ role = "system"; content = "你是一个专业的剧本分析助手。" }
        @{ role = "user"; content = "请分析以下剧本的故事核心，100字以内：$TEST_CONTENT" }
    )
    temperature = 0.3
    max_tokens = 500
} | ConvertTo-Json -Depth 10

$result3 = Measure-ApiCall -Name "DeepSeek API - 简单文本生成" -Url "$DEEPSEEK_API_URL/chat/completions" -ApiKey $DEEPSEEK_API_KEY -Body $body3
Write-Host ""

# ============================================
# 测试 4: 火山引擎 - 元数据提取 (完整Prompt)
# ============================================
$METADATA_PROMPT = @"
请快速分析以下剧本/小说内容，提取基础元数据：

【剧本内容】
$TEST_CONTENT

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
{"title": "", "wordCount": 0, "estimatedDuration": "", "characterCount": 0, "characterNames": [], "sceneCount": 0, "sceneNames": [], "chapterCount": 0, "genre": "", "tone": ""}
"@

$body4 = @{
    model = "doubao-pro-32k-241215"
    messages = @(
        @{ role = "system"; content = "你是一个专业的剧本分析助手，擅长从小说/剧本中提取结构化信息。请严格按照要求的JSON格式输出。" }
        @{ role = "user"; content = $METADATA_PROMPT }
    )
    temperature = 0.3
    max_tokens = 2000
    response_format = @{ type = "json_object" }
} | ConvertTo-Json -Depth 10

$result4 = Measure-ApiCall -Name "火山引擎 API - 元数据提取 (完整Prompt)" -Url "$VOLCENGINE_API_URL/chat/completions" -ApiKey $VOLCENGINE_API_KEY -Body $body4
Write-Host ""

# ============================================
# 测试 5: 并发测试 - 3个并行请求
# ============================================
Write-Host "测试 5: 火山引擎 API - 3个并行请求" -ForegroundColor Yellow
Write-Host "------------------------------------------"
Write-Host "模拟 GlobalContextExtractor 的并行提取..."

$startTime = Get-Date

# 创建3个并行任务
$jobs = @()
for ($i = 1; $i -le 3; $i++) {
    $body = @{
        model = "doubao-pro-32k-241215"
        messages = @(
            @{ role = "system"; content = "你是一个专业的剧本分析助手。" }
            @{ role = "user"; content = "任务${i}：请分析以下剧本的某个方面，100字以内：$TEST_CONTENT" }
        )
        temperature = 0.3
        max_tokens = 500
    } | ConvertTo-Json -Depth 10

    $job = Start-Job -ScriptBlock {
        param($Url, $ApiKey, $Body, $Index)

        $headers = @{
            "Authorization" = "Bearer $ApiKey"
            "Content-Type" = "application/json"
        }

        $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()

        try {
            $response = Invoke-RestMethod -Uri $Url -Method POST -Headers $headers -Body $Body -TimeoutSec 120
            $stopwatch.Stop()

            return @{
                Index = $Index
                Success = $true
                Duration = $stopwatch.ElapsedMilliseconds
            }
        }
        catch {
            $stopwatch.Stop()
            return @{
                Index = $Index
                Success = $false
                Duration = $stopwatch.ElapsedMilliseconds
                Error = $_.Exception.Message
            }
        }
    } -ArgumentList "$VOLCENGINE_API_URL/chat/completions", $VOLCENGINE_API_KEY, $body, $i

    $jobs += $job
}

# 等待所有任务完成
$results = $jobs | Wait-Job | Receive-Job
$jobs | Remove-Job

$endTime = Get-Date
$totalDuration = ($endTime - $startTime).TotalMilliseconds

Write-Host ""
foreach ($result in $results) {
    $status = if ($result.Success) { "✓" } else { "✗" }
    $color = if ($result.Success) { "Green" } else { "Red" }
    Write-Host "请求 $($result.Index): $status $($result.Duration) ms" -ForegroundColor $color
}

Write-Host ""
Write-Host "3个并行请求总耗时: $([Math]::Round($totalDuration)) ms" -ForegroundColor Cyan
Write-Host ""

# ============================================
# 汇总报告
# ============================================
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "测试完成 - 汇总报告" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

$results = @(
    @{ Name = "简单文本生成"; Duration = $result1.Duration; Success = $result1.Success }
    @{ Name = "结构化输出 (JSON)"; Duration = $result2.Duration; Success = $result2.Success }
    @{ Name = "DeepSeek 文本生成"; Duration = $result3.Duration; Success = $result3.Success }
    @{ Name = "元数据提取 (完整)"; Duration = $result4.Duration; Success = $result4.Success }
    @{ Name = "3个并行请求"; Duration = [Math]::Round($totalDuration); Success = $true }
)

foreach ($r in $results) {
    $status = if ($r.Success) { "✓" } else { "✗" }
    $color = if ($r.Success) { "Green" } else { "Red" }
    Write-Host "$status $($r.Name): $($r.Duration) ms" -ForegroundColor $color
}

Write-Host ""
Write-Host "参考对比:" -ForegroundColor Yellow
Write-Host "  - 项目日志中的全局上下文提取: 110,015 ms (110秒)" -ForegroundColor Gray
Write-Host "  - 如果单个API调用 > 30秒: 模型响应慢" -ForegroundColor Gray
Write-Host "  - 如果单个API调用 < 5秒: 代码/网络问题" -ForegroundColor Gray
