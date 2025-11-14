@echo off
:: Show how %~n2 extracts the file name from the second parameter

setlocal

:: Show raw second argument
set "raw2=%~2"
echo Raw second argument: "%raw2%"

:: Show filename without extension
set "name2=%~n2"
echo Filename without extension: "%name2%"

:: Show filename with extension
set "file2=%~nx2"
echo Filename with extension: "%file2%"

:: Show full path
set "full2=%~f2"
echo Full path: "%full2%"

endlocal
