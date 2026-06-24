# LifeSprout AWS Runbook

Repository: https://github.com/MJPL013/LifeSprout.git

This is the quick reference for setting up and running LifeSprout on one AWS EC2 Ubuntu instance. The longer explanation lives in `AWS_DEPLOYMENT_GUIDE.md`, and the detailed HTTPS microphone/Cloudflare Tunnel notebook lives in `AWS_CLOUDFLARE_HTTPS_RUNBOOK.md`.

## 1. Launch EC2

Recommended MVP instance:

- Name: `AMIGDA` or `amigda`
- AMI: Ubuntu Server LTS
- Instance type: `t3.micro` for basic testing, `t3.small` if you want smoother installs/builds
- Storage: 20-30 GB gp3
- Key pair: your `amigda` key pair, or use EC2 Instance Connect

Security group inbound rules:

| Type | Port | Source | Why |
| --- | --- | --- | --- |
| SSH | 22 | My IP | Admin access |
| HTTP | 80 | 0.0.0.0/0 | Public app URL |

Do not open Vite port `5173` for AWS. Do not open Node port `3001` unless you intentionally run without nginx.

## 2. Connect To The Instance

Use EC2 Instance Connect from the AWS console, or SSH from Windows PowerShell:

```powershell
ssh -i .\amigda.pem ubuntu@<EC2_PUBLIC_IPV4>
```

If EC2 Instance Connect fails, confirm your security group has SSH from your IP or the EC2 Instance Connect prefix list for your AWS region.

## 3. Clone And First Run

On the EC2 terminal:

```bash
git clone https://github.com/MJPL013/LifeSprout.git LifeSprout
cd LifeSprout
bash scripts/aws_lifesprout.sh
```

The script is repo-relative and does the setup for you:

- installs Linux packages, Node.js, nginx, and PM2 when missing;
- installs backend and frontend npm dependencies;
- creates `server/.env` from the template if needed;
- builds the React frontend;
- starts the Node server with PM2;
- configures nginx so the public app runs on port 80;
- saves PM2 so the app keeps running after you close the terminal.

## 4. Add API Keys

Edit runtime keys only on the EC2 machine. Never commit real keys.

```bash
nano server/.env
pm2 restart lifesprout --update-env
```

Recommended EC2 values:

```env
PORT=3001
TICK_INTERVAL_MS=5000
USE_OLLAMA=false
VOICE_PROVIDER=deepgram
DEEPGRAM_TTS_MODEL=aura-2-thalia-en
DEEPGRAM_STT_MODEL=nova-3
GEMINI_API_KEY=your_gemini_key_here
DEEPGRAM_API_KEY=your_deepgram_key_here
```

The app still runs without keys, but LLM/Deepgram features will use fallbacks or friendly error states.

## 5. Open The App

Use the EC2 public IPv4 from the AWS console:

```text
http://<EC2_PUBLIC_IPV4>/
```

Important:

- use `http://`, not `https://` unless you add TLS later;
- do not use `127.0.0.1` from your laptop browser;
- do not use the private IP like `172.31.x.x` from your laptop browser;
- do not add `:3001` when nginx is enabled;
- if the URL bar becomes doubled, replace the whole address with `http://<EC2_PUBLIC_IPV4>/`.

## 6. Update After Pushing Code

On EC2:

```bash
cd ~/LifeSprout
bash scripts/aws_lifesprout.sh --pull --skip-system
```

Use `--skip-system` for normal updates after the first install. If packages or Node are missing, run without `--skip-system`.

## 7. Health Checks

```bash
pm2 status
pm2 logs lifesprout --lines 100
sudo nginx -t
sudo systemctl status nginx --no-pager
curl -I http://127.0.0.1
curl -I http://127.0.0.1:3001
```

Expected shape:

- PM2 app `lifesprout` is online;
- nginx config test is successful;
- port 80 responds locally;
- port 3001 responds locally.

## 8. Runtime Data

MVP accounts and groups are stored on the EC2 disk:

- `server/data/accounts.json`
- `server/data/rooms.json`

Normal script reruns and PM2 restarts preserve these files. Deleting the instance, replacing the disk, or recloning from scratch will not preserve users unless you back up these files.

## 9. Microphone Note

The mic button is real. It attempts Deepgram live speech-to-text through Socket.IO and falls back to browser speech recognition when possible.

Browser microphone APIs are much more reliable on HTTPS. Raw `http://<EC2_PUBLIC_IPV4>/` is okay for quick UI testing, but for a polished voice demo use a domain plus HTTPS later.

## 10. Common Fixes

### Public URL Does Not Open

Check security group inbound HTTP port 80 from `0.0.0.0/0`, then run:

```bash
sudo systemctl restart nginx
pm2 restart lifesprout --update-env
```

### App Opens But API Actions Fail

Run the update script again so the frontend build and backend are from the same commit:

```bash
bash scripts/aws_lifesprout.sh --pull --skip-system
```

### Voice Or LLM Fails

Check `server/.env`, then restart PM2:

```bash
nano server/.env
pm2 restart lifesprout --update-env
```

### Need Direct Node Mode

Only use this if nginx is not desired:

```bash
bash scripts/aws_lifesprout.sh --no-nginx
```

Then open port `3001` in the security group and use:

```text
http://<EC2_PUBLIC_IPV4>:3001/
```
