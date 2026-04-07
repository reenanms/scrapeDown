@echo off
REM Script to build and zip the ScrapeDown extension

REM Navigate to project root
cd /d "%~dp0.."

echo Building the project...
call npm run build
if %errorlevel% neq 0 (
    echo Build failed. Exiting.
    exit /b %errorlevel%
)

set ZIP_NAME=release\ScrapeDown.zip
if not exist release mkdir release
if exist "%ZIP_NAME%" del "%ZIP_NAME%"

set STAGING_DIR=release\staging
if exist "%STAGING_DIR%" rmdir /s /q "%STAGING_DIR%"
mkdir "%STAGING_DIR%"
mkdir "%STAGING_DIR%\src"

echo Copying dist files...
xcopy /s /e /i /y dist "%STAGING_DIR%\dist"

echo Copying HTML files...
xcopy /y src\*.html "%STAGING_DIR%\src"

echo Copying extension dependencies...
copy /y manifest.json "%STAGING_DIR%\"
if exist src\icons xcopy /s /e /i /y src\icons "%STAGING_DIR%\src\icons"
if exist src\vendor xcopy /s /e /i /y src\vendor "%STAGING_DIR%\src\vendor"

echo Creating zip archive...
powershell -Command "Compress-Archive -Path '%STAGING_DIR%\*' -DestinationPath '%ZIP_NAME%' -Force"

echo Cleaning up staging...
rmdir /s /q "%STAGING_DIR%"

if exist "%ZIP_NAME%" (
  echo Extension zipped successfully at %ZIP_NAME%
) else (
  echo Failed to create zip file.
)
