$ws = New-Object -ComObject WScript.Shell
$sc = $ws.CreateShortcut('D:\Documents\Desktop\要事第一.lnk')
$sc.TargetPath = 'D:\Documents\Desktop\要事第一.bat'
$sc.WorkingDirectory = 'C:\Users\Administrator\Documents\trae_projects\first cc\four-quadrants'
$sc.Save()
Write-Output "done"
