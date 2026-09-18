@echo off
rem Liga o agente de impressao e o religa sozinho se ele travar ou fechar (tarefa 4.11).
rem Coloque um atalho deste arquivo na pasta "Inicializar" do Windows (veja o README).
cd /d %~dp0
:repetir
echo [%date% %time%] Iniciando o agente de impressao...
node --env-file=.env src\index.js
echo [%date% %time%] O agente parou. Reiniciando em 5 segundos...
timeout /t 5 /nobreak >nul
goto repetir
