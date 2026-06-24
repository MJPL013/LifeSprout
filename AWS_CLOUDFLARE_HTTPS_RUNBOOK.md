# LifeSprout AWS + Cloudflare HTTPS Runbook

Repository: https://github.com/MJPL013/LifeSprout.git

This is the practical deployment notebook for running LifeSprout on AWS EC2 and exposing it through HTTPS with Cloudflare Tunnel so browser microphone access works. It covers the first-time path, the update path after GitHub pushes, the quick free `trycloudflare.com` path, the permanent domain path, and the exact issues we faced while deploying.

## Goal

LifeSprout needs two things in AWS:

- A Node/Express app that keeps running after the SSH terminal is closed.
- An HTTPS public URL so mobile and desktop browsers allow microphone input for Deepgram voice features.

Final working shape:

```text
Browser
  -> HTTPS Cloudflare URL
  -> Cloudflare Tunnel running on EC2
  -> nginx on EC2 port 80
  -> LifeSprout Node app on 127.0.0.1:3001
```

On AWS, do not run the Vite dev server. The deployment script builds the React client and the backend serves it.

## What We Faced And How We Solved It

| Problem | What happened | Fix |
| --- | --- | --- |
| EC2 browser connect failed | EC2 Instance Connect initially failed to SSH | Security group/region access was corrected, then connected as `ubuntu`. |
| App opened locally but not publicly | Browser was pointed to `127.0.0.1` or a private IP | Use the EC2 public URL or Cloudflare HTTPS URL from outside EC2. |
| Login/provision request failed | URL became doubled like `http://16.113.27.41/http://16.113.27.41/` | Replace the entire address bar with one clean root URL. |
| Microphone did not work on raw EC2 URL | Public `http://` is not a reliable secure context for browser mic APIs | Use HTTPS through Cloudflare Tunnel. |
| Cloudflare domain dropdown showed `No valid options` | No domain was active in Cloudflare | Use temporary `trycloudflare.com` for fast testing, or add a real domain for a fixed URL. |
| `sudo: cloudflared: command not found` | Cloudflare connector was not installed on EC2 | Install `cloudflared` from the Cloudflare apt repo. |
| Temporary tunnel stopped after terminal close | A quick tunnel was started manually | Install a `systemd` service called `lifesprout-quick-tunnel`. |
| Old Cloudflare URL stopped working | Multiple quick tunnels were started and stopped | Use the latest URL printed by the service logs. |

## First-Time AWS Setup

### 1. Launch EC2

Recommended MVP configuration:

| Setting | Value |
| --- | --- |
| Name | `AMIGDA` or `amigda` |
| AMI | Ubuntu Server LTS |
| Instance type | `t3.micro` for basic testing, `t3.small` for smoother installs/builds |
| Storage | 20-30 GB gp3 |
| Key pair | `amigda` key pair or EC2 Instance Connect |

Security group inbound rules:

| Type | Port | Source | Why |
| --- | --- | --- | --- |
| SSH | 22 | My IP, or EC2 Instance Connect prefix list | Admin access |
| HTTP | 80 | 0.0.0.0/0 | Public app traffic through nginx |

Do not open port `5173` on AWS. Do not open port `3001` unless you intentionally deploy without nginx.

### 2. Connect To EC2

Use AWS Console -> EC2 -> Instances -> select instance -> Connect -> EC2 Instance Connect.

Expected prompt:

```bash
ubuntu@ip-172-31-6-74:~$
```

### 3. Clone The Repo

```bash
git clone https://github.com/MJPL013/LifeSprout.git LifeSprout
cd LifeSprout
```

If the repo already exists:

```bash
cd ~/LifeSprout
git pull --ff-only
```

### 4. Run The One-Command AWS Setup

From the repo root:

```bash
bash scripts/aws_lifesprout.sh
```

The script installs system packages when needed, installs backend/frontend dependencies, builds the React client, starts the backend with PM2 as `lifesprout`, configures nginx on public port `80`, and saves PM2 startup so the app stays alive after terminal close.

### 5. Add Runtime API Keys

Edit only the EC2 runtime env file. Do not commit real keys.

```bash
cd ~/LifeSprout
nano server/.env
```

Recommended values:

```env
PORT=3001
TICK_INTERVAL_MS=5000
USE_OLLAMA=false
VOICE_PROVIDER=deepgram
DEEPGRAM_TTS_MODEL=aura-2-thalia-en
DEEPGRAM_STT_MODEL=nova-3
DEEPGRAM_AGENT_URL=wss://agent.deepgram.com/v1/agent/converse
DEEPGRAM_AGENT_LLM_PROVIDER=open_ai
DEEPGRAM_AGENT_LLM_MODEL=gpt-4o-mini
DEEPGRAM_AGENT_TEMPERATURE=0.55
GEMINI_API_KEY=your_gemini_key_here
DEEPGRAM_API_KEY=your_deepgram_key_here
```

After editing:

```bash
pm2 restart lifesprout --update-env
pm2 status
```

### 6. Verify Local EC2 Health

```bash
pm2 status
curl -I http://127.0.0.1
curl -I http://127.0.0.1:3001/api/rooms
```

Expected:

- `pm2 status` shows `lifesprout` as `online`.
- `curl -I http://127.0.0.1` returns `HTTP/1.1 200 OK`.
- `curl -I http://127.0.0.1:3001/api/rooms` returns `HTTP/1.1 200 OK`.

At this point the app works on raw HTTP:

```text
http://<EC2_PUBLIC_IPV4>/
```

For microphone testing, continue to Cloudflare HTTPS.

## Fast Free HTTPS Path: trycloudflare.com

Use this when you need a working HTTPS demo quickly and do not have a domain connected to Cloudflare.

Important behavior:

- No Cloudflare domain is required.
- The URL looks like `https://random-words.trycloudflare.com`.
- It supports HTTPS, so browser mic permission works.
- It can keep running after terminal close if installed as a service.
- It is not guaranteed to be permanent. If the tunnel is recreated or EC2 restarts, the random URL can change.

### 1. Install cloudflared

Run this on EC2:

```bash
sudo mkdir -p --mode=0755 /usr/share/keyrings
curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg | sudo tee /usr/share/keyrings/cloudflare-main.gpg >/dev/null
echo 'deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared any main' | sudo tee /etc/apt/sources.list.d/cloudflared.list
sudo apt-get update
sudo apt-get install -y cloudflared
cloudflared --version
```

If `cloudflared --version` prints a version, installation is correct.

### 2. Create A Persistent Quick Tunnel Service

Copy-paste this whole block on EC2:

```bash
cd ~

sudo systemctl stop lifesprout-quick-tunnel 2>/dev/null || true
sudo systemctl disable lifesprout-quick-tunnel 2>/dev/null || true

pkill -f "cloudflared tunnel --no-autoupdate --url http://127.0.0.1:80" 2>/dev/null || true

sudo tee /etc/systemd/system/lifesprout-quick-tunnel.service >/dev/null <<'EOF'
[Unit]
Description=LifeSprout HTTPS Quick Cloudflare Tunnel
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu
ExecStart=/usr/bin/cloudflared tunnel --no-autoupdate --url http://127.0.0.1:80
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable lifesprout-quick-tunnel
sudo systemctl restart lifesprout-quick-tunnel

sleep 8

sudo systemctl status lifesprout-quick-tunnel --no-pager
journalctl -u lifesprout-quick-tunnel -n 100 --no-pager | grep -o 'https://[^ ]*trycloudflare.com' | tail -1
```

The final line prints the live HTTPS URL. Use that URL for testing.

### 3. Get The Current URL Later

```bash
journalctl -u lifesprout-quick-tunnel -n 100 --no-pager | grep -o 'https://[^ ]*trycloudflare.com' | tail -1
```

### 4. Check Or Restart The Tunnel

```bash
sudo systemctl status lifesprout-quick-tunnel --no-pager
sudo systemctl restart lifesprout-quick-tunnel
journalctl -u lifesprout-quick-tunnel -n 100 --no-pager
```

If a restart creates a new random URL, use the new URL.

### 5. Stop The Unused Named Tunnel Service

If you previously installed a Cloudflare named connector but do not have a domain, stop it so only the quick tunnel is active:

```bash
sudo systemctl disable --now cloudflared
sudo systemctl status lifesprout-quick-tunnel --no-pager
```

## Permanent HTTPS Path: Cloudflare Tunnel With Your Domain

Use this when you want a fixed URL like:

```text
https://amigda.yourdomain.com
```

Cloudflare Tunnel can be free for this use case, but a domain is required. If you do not already own a domain, the domain itself usually costs money.

### 1. Add A Domain To Cloudflare

In the Cloudflare dashboard:

1. Account Home -> Domains.
2. Add a domain.
3. Follow Cloudflare instructions to update nameservers at your domain provider.
4. Wait until the domain is active in Cloudflare.

If the tunnel route page says `No valid options` in the domain dropdown, this step is not complete.

### 2. Create A Named Tunnel

In Cloudflare:

1. Zero Trust / Cloudflare One.
2. Networks -> Tunnels or Networks -> Connectors.
3. Create tunnel.
4. Choose `Cloudflared`.
5. Name it `amigda`.
6. Choose operating system `Debian`.
7. Choose architecture `64-bit`.

Cloudflare will show commands to install and run a connector.

### 3. Install The Named Connector On EC2

If `cloudflared` is not installed, run the install block from the quick tunnel section first.

Then copy the exact service install command from Cloudflare. It looks like this:

```bash
sudo cloudflared service install <TOKEN_FROM_CLOUDFLARE_UI>
```

Do not put the real token into git or documentation. The token is sensitive.

Check it:

```bash
sudo systemctl status cloudflared --no-pager
```

Expected:

```text
Active: active (running)
```

### 4. Route The Tunnel

Back in Cloudflare on the `Route tunnel` screen:

Hostname:

```text
Subdomain: amigda
Domain: your active Cloudflare domain
Path: leave empty
```

Service:

```text
Type: HTTP
URL: localhost:80
```

Click `Complete setup` or `Save tunnel`.

Why service type is `HTTP`: that is the internal EC2 connection from Cloudflare to nginx. Users still open the public URL as HTTPS:

```text
https://amigda.yourdomain.com
```

## Updating AWS After Pushing To GitHub

When new code is pushed to GitHub, SSH into EC2 and run:

```bash
cd ~/LifeSprout
bash scripts/aws_lifesprout.sh --pull --skip-system
```

Use `--skip-system` for normal updates because Node, nginx, and PM2 are already installed. If system packages are missing or broken, run without it:

```bash
cd ~/LifeSprout
bash scripts/aws_lifesprout.sh --pull
```

Then verify:

```bash
pm2 status
curl -I http://127.0.0.1
curl -I http://127.0.0.1:3001/api/rooms
```

The Cloudflare tunnel points to nginx on port `80`, so you normally do not need to recreate the tunnel after code updates.

## Running Again After Closing The Terminal

If you close your SSH terminal:

- PM2 keeps LifeSprout running.
- nginx keeps serving port `80`.
- `lifesprout-quick-tunnel.service` keeps the quick HTTPS tunnel running.

To reconnect later and inspect everything:

```bash
cd ~/LifeSprout
pm2 status
sudo systemctl status nginx --no-pager
sudo systemctl status lifesprout-quick-tunnel --no-pager
journalctl -u lifesprout-quick-tunnel -n 100 --no-pager | grep -o 'https://[^ ]*trycloudflare.com' | tail -1
```

If only app code changed:

```bash
cd ~/LifeSprout
bash scripts/aws_lifesprout.sh --pull --skip-system
```

If only `.env` changed:

```bash
cd ~/LifeSprout
nano server/.env
pm2 restart lifesprout --update-env
```

## Voice Testing Checklist

Use the HTTPS Cloudflare URL, not the raw EC2 HTTP IP, when testing mic.

1. Open the Cloudflare HTTPS URL.
2. Login or create an account.
3. Open the personal plant hub.
4. Click the mic.
5. Allow browser microphone permission.
6. Speak naturally.
7. Confirm the user transcript appears in chat.
8. Confirm the plant responds.
9. If Personal Hub uses Deepgram Voice Agent, it should feel continuous.
10. In group chat, mic can use the older STT pipeline so group behavior remains controlled.

## Troubleshooting Commands

### App And API

```bash
cd ~/LifeSprout
pm2 status
pm2 logs lifesprout --lines 100
curl -I http://127.0.0.1
curl -I http://127.0.0.1:3001/api/rooms
```

### nginx

```bash
sudo nginx -t
sudo systemctl status nginx --no-pager
sudo systemctl restart nginx
```

### Quick Cloudflare Tunnel

```bash
sudo systemctl status lifesprout-quick-tunnel --no-pager
journalctl -u lifesprout-quick-tunnel -n 100 --no-pager
journalctl -u lifesprout-quick-tunnel -n 100 --no-pager | grep -o 'https://[^ ]*trycloudflare.com' | tail -1
```

### Named Cloudflare Tunnel

```bash
sudo systemctl status cloudflared --no-pager
journalctl -u cloudflared -n 100 --no-pager
```

### Restart Everything

```bash
cd ~/LifeSprout
pm2 restart lifesprout --update-env
sudo systemctl restart nginx
sudo systemctl restart lifesprout-quick-tunnel
```

## Common Error Reference

### `sudo: cloudflared: command not found`

Install `cloudflared` using the install commands in the quick tunnel section.

### Cloudflare Domain Dropdown Has `No valid options`

You do not have an active domain in Cloudflare. Use the quick `trycloudflare.com` tunnel for now, or add a domain to Cloudflare for a fixed URL.

### Browser Mic Does Not Open

Use HTTPS:

```text
https://<random>.trycloudflare.com
```

or:

```text
https://amigda.yourdomain.com
```

Do not use plain HTTP for voice demo testing.

### Old URL Stopped Working

If you restarted the quick tunnel service, the random URL may have changed. Get the latest:

```bash
journalctl -u lifesprout-quick-tunnel -n 100 --no-pager | grep -o 'https://[^ ]*trycloudflare.com' | tail -1
```

### API Fails After Pulling Code

Rebuild and restart from GitHub:

```bash
cd ~/LifeSprout
bash scripts/aws_lifesprout.sh --pull --skip-system
```

### Deepgram Voice Fails

Check env and restart:

```bash
cd ~/LifeSprout
nano server/.env
pm2 restart lifesprout --update-env
pm2 logs lifesprout --lines 100
```

Confirm `DEEPGRAM_API_KEY` exists and `VOICE_PROVIDER=deepgram`.

## Cost Notes

Cloudflare quick tunnels and Cloudflare Tunnel basics can be free for MVP testing. The real costs usually come from:

- AWS EC2 instance runtime;
- AWS storage and network usage;
- Deepgram API usage;
- LLM API usage;
- domain purchase, if you want a fixed custom URL.

Stopping the EC2 instance stops the app. Terminating the EC2 instance can delete runtime data if the disk is deleted.

## Files And Data To Preserve

Runtime data:

```text
server/data/accounts.json
server/data/rooms.json
```

Runtime secrets:

```text
server/.env
```

These are intentionally not committed to GitHub.

Before deleting or replacing the EC2 instance, back them up:

```bash
cd ~/LifeSprout
tar -czf lifesprout-runtime-backup.tar.gz server/.env server/data
ls -lh lifesprout-runtime-backup.tar.gz
```

## Short Operator Cheat Sheet

First time:

```bash
git clone https://github.com/MJPL013/LifeSprout.git LifeSprout
cd LifeSprout
bash scripts/aws_lifesprout.sh
nano server/.env
pm2 restart lifesprout --update-env
```

Install quick HTTPS tunnel:

```bash
sudo mkdir -p --mode=0755 /usr/share/keyrings
curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg | sudo tee /usr/share/keyrings/cloudflare-main.gpg >/dev/null
echo 'deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared any main' | sudo tee /etc/apt/sources.list.d/cloudflared.list
sudo apt-get update
sudo apt-get install -y cloudflared
```

Create/recreate quick HTTPS service:

```bash
cd ~
sudo systemctl stop lifesprout-quick-tunnel 2>/dev/null || true
sudo systemctl disable lifesprout-quick-tunnel 2>/dev/null || true
pkill -f "cloudflared tunnel --no-autoupdate --url http://127.0.0.1:80" 2>/dev/null || true
sudo tee /etc/systemd/system/lifesprout-quick-tunnel.service >/dev/null <<'EOF'
[Unit]
Description=LifeSprout HTTPS Quick Cloudflare Tunnel
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu
ExecStart=/usr/bin/cloudflared tunnel --no-autoupdate --url http://127.0.0.1:80
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
sudo systemctl daemon-reload
sudo systemctl enable lifesprout-quick-tunnel
sudo systemctl restart lifesprout-quick-tunnel
sleep 8
journalctl -u lifesprout-quick-tunnel -n 100 --no-pager | grep -o 'https://[^ ]*trycloudflare.com' | tail -1
```

Update app after GitHub push:

```bash
cd ~/LifeSprout
bash scripts/aws_lifesprout.sh --pull --skip-system
```

Check everything:

```bash
pm2 status
curl -I http://127.0.0.1
curl -I http://127.0.0.1:3001/api/rooms
sudo systemctl status lifesprout-quick-tunnel --no-pager
journalctl -u lifesprout-quick-tunnel -n 100 --no-pager | grep -o 'https://[^ ]*trycloudflare.com' | tail -1
```
