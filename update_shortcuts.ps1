$ws = New-Object -ComObject WScript.Shell

# 要事第一 shortcut
$s1 = $ws.CreateShortcut("D:\Documents\Desktop\🎯 要事第一.lnk")
$s1.TargetPath = "D:\Documents\Desktop\🎯 要事第一.bat"
$s1.WorkingDirectory = "C:\Users\Administrator\Documents\trae_projects\first cc\four-quadrants"
$s1.Save()

# 番茄钟 shortcut
$s2 = $ws.CreateShortcut("D:\Documents\Desktop\🍅 番茄钟.lnk")
$s2.TargetPath = "D:\Documents\Desktop\🍅 番茄钟.bat"
$s2.WorkingDirectory = "C:\Users\Administrator\Documents\trae_projects\first cc\pomodoro-timer"
$s2.Save()

Write-Output "done"
