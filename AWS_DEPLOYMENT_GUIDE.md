# LifeSprout AWS Deployment Guide

Repository: https://github.com/MJPL013/LifeSprout.git

This guide deploys LifeSprout on a single AWS EC2 Linux instance for MVP testing. The deployment uses one Node/Express process for the API, Socket.IO, Deepgram routes, and the built React frontend. nginx exposes a stable public HTTP URL on port 80, and PM2 keeps the app alive after you close the terminal.

## Deployment Model

LifeSprout has two development pieces locally:

- `server/`: Node.js, Express, Socket.IO, JSON runtime stores, CSV telemetry, LLM and Deepgram routes.
- `client/`: React/Vite frontend.

On AWS, the script builds `client/dist`, then `server/index.js` serves that built frontend. So AWS runs one PM2 process called `lifesprout` by default. nginx maps public traffic from port `80` to the Node app on internal port `3001`.

Default public URL:

```text
http://<YOUR_EC2_PUBLIC_IP>/
```

No public Vite port is required in this deployment path.

## Recommended AWS Shape

- AMI: Ubuntu Server 22.04 LTS or 24.04 LTS.
- Instance size: `t2.micro` or `t3.micro` for a small MVP demo.
- Storage: default 8 GB works, but 16-30 GB is more comfortable for Node modules and logs.
- Security group inbound rules:
  - SSH `22` from your IP, or use EC2 Instance Connect.
  - HTTP `80` from `0.0.0.0/0`.
  - HTTPS `443` only if you later add TLS.
- You do not need to expose `5173`.
- You do not need to expose `3001` unless you run the script with `--no-nginx`.

## Runtime Persistence

Accounts and groups are MVP JSON files under `server/data` on the EC2 disk:

- `server/data/accounts.json`
- `server/data/rooms.json`

This is fine for single-instance AWS testing. It is not a production database. Normal PM2 restarts, rebuilds, and script reruns should preserve these files. Instance deletion, disk replacement, or a fresh clone will not preserve them unless you back them up or move storage to a database/EBS-backed plan.

## Environment Variables

Do not commit `server/.env`. The deployment script creates `server/.env` from `server/.env.template` if it does not already exist.

After the first script run, edit it from the repo root:

```bash
nano server/.env
pm2 restart lifesprout --update-env
```

Recommended EC2 `.env` shape:

```env
GEMINI_API_KEY=your_gemini_key_here
DEEPGRAM_API_KEY=your_deepgram_key_here
USE_OLLAMA=false
DEEPGRAM_TTS_MODEL=aura-2-thalia-en
DEEPGRAM_STT_MODEL=nova-3
VOICE_PROVIDER=deepgram
PORT=3001
TICK_INTERVAL_MS=5000
```

For EC2 cloud testing, keep `USE_OLLAMA=false` unless you install and run Ollama on the instance.

## First-Time EC2 Setup

1. Launch an Ubuntu EC2 instance.
2. Connect using EC2 Instance Connect or SSH.
3. Clone the repository:

```bash
git clone https://github.com/MJPL013/LifeSprout.git LifeSprout
cd LifeSprout
```

4. Run the single deployment script:

```bash
bash scripts/aws_lifesprout.sh
```

The script is repo-relative. It figures out the repo root from its own location, so it does not care where you cloned the project.

The script will:

- install system packages when missing: Node.js, npm, git, build tools, nginx;
- install PM2 globally when missing;
- create `server/.env` from the template if needed;
- run `npm ci` in `server` and `client`;
- build the React client with Vite;
- start or restart `server/index.js` under PM2;
- configure nginx from public port `80` to internal Node port `3001`;
- save PM2 so the app survives terminal close and reboot;
- print the app URL.

## Updating After New Code Is Pushed

From the EC2 repo root:

```bash
bash scripts/aws_lifesprout.sh --pull
```

That pulls the latest code, installs dependencies, rebuilds the client, restarts PM2, refreshes nginx config, and prints the URL again.

## Script Options

```bash
bash scripts/aws_lifesprout.sh --help
```

Common options:

```bash
# Pull latest code before deploying
bash scripts/aws_lifesprout.sh --pull

# Skip nginx and serve directly on the Node port
bash scripts/aws_lifesprout.sh --no-nginx

# Skip apt/yum/dnf installation if the machine is already prepared
bash scripts/aws_lifesprout.sh --skip-system
```

Useful environment overrides:

```bash
APP_NAME=lifesprout-demo SERVER_PORT=3001 PUBLIC_PORT=80 bash scripts/aws_lifesprout.sh
```

## Stable URL Behavior

With the default nginx setup, use:

```text
http://<YOUR_EC2_PUBLIC_IP>/
```

The app should stay available after the terminal is closed because PM2 runs the Node server in the background. nginx receives browser traffic on port 80 and proxies it to the Node app on port 3001.

If you choose not to use nginx:

```bash
bash scripts/aws_lifesprout.sh --no-nginx
```

Then open port `3001` in the security group and use:

```text
http://<YOUR_EC2_PUBLIC_IP>:3001/
```

## Useful Commands

Run these from anywhere on the EC2 instance:

```bash
pm2 status
pm2 logs lifesprout
pm2 restart lifesprout --update-env
pm2 save
sudo nginx -t
sudo systemctl restart nginx
```

Run these from the repo root:

```bash
nano server/.env
bash scripts/aws_lifesprout.sh --pull
```

## Common Issues

### The URL Does Not Open

Check the EC2 security group allows inbound HTTP port `80`. Then run:

```bash
pm2 status
sudo systemctl status nginx --no-pager
sudo nginx -t
```

### Login Or Group Creation Loses Data After Redeploy

The JSON files are local runtime data. They should survive normal PM2 restarts and rebuilds, but not instance replacement or manual deletion.

### Deepgram Or LLM Voice Does Not Work

Check `server/.env` has real keys and restart:

```bash
pm2 restart lifesprout --update-env
```

The UI should show friendly fallback messages instead of raw API errors.

### Browser Blocks Microphone Or Voice

Raw HTTP on an EC2 IP is acceptable for quick testing, but browsers are stricter with microphone permissions. For a stronger demo, attach a domain and HTTPS certificate later.

### The Script Fails On npm ci

Make sure `package-lock.json` is committed for both `server` and `client`. If dependency lock files change, commit and push them before running `--pull` on EC2.

## Files That Should Not Be Pushed

The root `.gitignore` excludes local/runtime material:

- `server/.env`
- `server/node_modules/`
- `client/node_modules/`
- `server/data/accounts.json`
- `server/data/rooms.json`
- `UI_files`
- `.agents/`
- `.codex/`
- old system prompt/reference files

If any of these were previously tracked, commit their removal from git. The local files can remain on your machine.