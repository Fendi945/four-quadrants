$ws = New-Object -ComObject WScript.Shell
$sc = $ws.CreateShortcut('D:\Documents\Desktop\要事第一.lnk')
$sc.TargetPath = 'C:\Users\Administrator\Documents\trae_projects\first cc\four-quadrants\启动要事第一.bat'
$sc.WorkingDirectory = 'C:\Users\Administrator\Documents\trae_projects\first cc\four-quadrants'
$sc.Description = 'Si Xiang Xian - Yao Shi Di Yi'
$sc.Save()
Write-Host "Done"
