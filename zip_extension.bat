@echo off
REM Script to zip the ScrapeDown extension folder for Chrome Web Store publishing

REM Set the extension folder path
set EXT_DIR=%~dp0
set ZIP_NAME=release\ScrapeDown.zip

REM Create release folder if it does not exist
if not exist release mkdir release

REM Remove old zip if exists
if exist %ZIP_NAME% del %ZIP_NAME%

REM Use PowerShell to zip all files and folders in the current directory
powershell -Command "Get-ChildItem -Path . -Exclude 'release', '.git', 'node_modules', 'zip_extension.bat' | Compress-Archive -DestinationPath '%ZIP_NAME%' -Force"

REM Notify user
if exist %ZIP_NAME% (
  echo Extension zipped successfully: %ZIP_NAME%
) else (
  echo Failed to create zip file.
)
