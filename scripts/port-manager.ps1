# 端口管理工具
# 用于管理项目开发服务器的端口

param(
    [Parameter()]
    [ValidateSet("list", "kill", "kill-all", "help")]
    [string]$Action = "list",
    
    [Parameter()]
    [int]$Port = 0
)

function Show-Help {
    Write-Host @"
端口管理工具 - 帮助
==================

用法:
  .\scripts\port-manager.ps1 -Action <action> [-Port <port>]

操作:
  list      - 列出所有 Node.js 进程和占用的端口（默认）
  kill      - 关闭指定端口（需要 -Port 参数）
  kill-all  - 关闭所有 Node.js 进程
  help      - 显示此帮助

示例:
  # 查看所有端口
  .\scripts\port-manager.ps1
  
  # 关闭 3001 端口
  .\scripts\port-manager.ps1 -Action kill -Port 3001
  
  # 关闭所有 Node 进程
  .\scripts\port-manager.ps1 -Action kill-all

"@ -ForegroundColor Cyan
}

function Get-PortProcesses {
    $processes = @()
    
    # 获取所有 Node 进程
    $nodeProcesses = Get-Process -Name "node" -ErrorAction SilentlyContinue
    
    foreach ($proc in $nodeProcesses) {
        try {
            # 获取进程占用的端口
            $connections = Get-NetTCPConnection -OwningProcess $proc.Id -ErrorAction SilentlyContinue | 
                Where-Object { $_.LocalPort -ge 3000 -and $_.LocalPort -le 3010 }
            
            if ($connections) {
                foreach ($conn in $connections) {
                    $processes += [PSCustomObject]@{
                        PID = $proc.Id
                        ProcessName = $proc.ProcessName
                        Port = $conn.LocalPort
                        State = $conn.State
                        StartTime = $proc.StartTime
                        CommandLine = (Get-CimInstance Win32_Process -Filter "ProcessId = $($proc.Id)").CommandLine
                    }
                }
            } else {
                # 没有占用 3000-3010 端口的 Node 进程
                $processes += [PSCustomObject]@{
                    PID = $proc.Id
                    ProcessName = $proc.ProcessName
                    Port = "N/A"
                    State = "N/A"
                    StartTime = $proc.StartTime
                    CommandLine = (Get-CimInstance Win32_Process -Filter "ProcessId = $($proc.Id)").CommandLine
                }
            }
        } catch {
            # 忽略错误
        }
    }
    
    return $processes
}

function Show-ProcessList {
    Write-Host "`n当前 Node.js 进程列表:" -ForegroundColor Green
    Write-Host "========================" -ForegroundColor Green
    
    $processes = Get-PortProcesses
    
    if ($processes.Count -eq 0) {
        Write-Host "没有找到 Node.js 进程" -ForegroundColor Yellow
        return
    }
    
    # 按端口排序
    $sortedProcesses = $processes | Sort-Object Port
    
    # 显示表头
    Write-Host "`n{0,-8} {1,-12} {2,-8} {3,-15} {4,-20}" -f "PID", "进程名", "端口", "状态", "启动时间" -ForegroundColor Gray
    Write-Host "-------- ------------ -------- --------------- --------------------" -ForegroundColor Gray
    
    foreach ($proc in $sortedProcesses) {
        $color = if ($proc.Port -eq 3000) { "Green" } 
                 elseif ($proc.Port -match "^300[1-9]$") { "Yellow" }
                 else { "White" }
        
        Write-Host "{0,-8} {1,-12} {2,-8} {3,-15} {4,-20}" -f 
            $proc.PID, 
            $proc.ProcessName, 
            $proc.Port, 
            $proc.State, 
            $proc.StartTime.ToString("yyyy-MM-dd HH:mm:ss") -ForegroundColor $color
    }
    
    Write-Host "`n说明:" -ForegroundColor Gray
    Write-Host "  绿色 = 3000 端口（主项目）" -ForegroundColor Green
    Write-Host "  黄色 = 3001+ 端口（额外实例）" -ForegroundColor Yellow
    Write-Host "  白色 = 未占用 3000-3010 端口" -ForegroundColor White
}

function Stop-PortProcess {
    param([int]$TargetPort)
    
    Write-Host "`n正在查找占用端口 $TargetPort 的进程..." -ForegroundColor Yellow
    
    try {
        $connection = Get-NetTCPConnection -LocalPort $TargetPort -ErrorAction SilentlyContinue | Select-Object -First 1
        
        if (-not $connection) {
            Write-Host "端口 $TargetPort 没有被占用" -ForegroundColor Green
            return
        }
        
        $proc = Get-Process -Id $connection.OwningProcess -ErrorAction SilentlyContinue
        
        if ($proc) {
            Write-Host "找到进程:" -ForegroundColor Cyan
            Write-Host "  PID: $($proc.Id)" -ForegroundColor White
            Write-Host "  名称: $($proc.ProcessName)" -ForegroundColor White
            Write-Host "  端口: $TargetPort" -ForegroundColor White
            Write-Host "  启动时间: $($proc.StartTime)" -ForegroundColor White
            
            $confirm = Read-Host "`n确认要终止此进程? (y/N)"
            
            if ($confirm -eq 'y' -or $confirm -eq 'Y') {
                Stop-Process -Id $proc.Id -Force
                Write-Host "进程已终止" -ForegroundColor Green
            } else {
                Write-Host "操作已取消" -ForegroundColor Yellow
            }
        }
    } catch {
        Write-Host "错误: $_" -ForegroundColor Red
    }
}

function Stop-AllNodeProcesses {
    Write-Host "`n正在查找所有 Node.js 进程..." -ForegroundColor Yellow
    
    $processes = Get-Process -Name "node" -ErrorAction SilentlyContinue
    
    if ($processes.Count -eq 0) {
        Write-Host "没有找到 Node.js 进程" -ForegroundColor Green
        return
    }
    
    Write-Host "找到 $($processes.Count) 个 Node.js 进程:" -ForegroundColor Cyan
    foreach ($proc in $processes) {
        Write-Host "  - PID: $($proc.Id), 启动时间: $($proc.StartTime)" -ForegroundColor White
    }
    
    $confirm = Read-Host "`n确认要终止所有 Node.js 进程? (y/N)"
    
    if ($confirm -eq 'y' -or $confirm -eq 'Y') {
        $processes | Stop-Process -Force
        Write-Host "所有 Node.js 进程已终止" -ForegroundColor Green
    } else {
        Write-Host "操作已取消" -ForegroundColor Yellow
    }
}

# 主逻辑
switch ($Action) {
    "help" { Show-Help }
    "list" { Show-ProcessList }
    "kill" { 
        if ($Port -eq 0) {
            Write-Host "错误: 请指定要关闭的端口，例如: -Port 3001" -ForegroundColor Red
            Show-Help
        } else {
            Stop-PortProcess -TargetPort $Port
        }
    }
    "kill-all" { Stop-AllNodeProcesses }
    default { Show-ProcessList }
}

Write-Host "`n" 
