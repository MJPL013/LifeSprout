# LifeSprout AWS Runbook

Repository: https://github.com/MJPL013/LifeSprout.git

Use `AWS_DEPLOYMENT_GUIDE.md` as the primary deployment guide. This file is the short operator runbook.

## First Deploy From EC2

```bash
git clone https://github.com/MJPL013/LifeSprout.git LifeSprout
cd LifeSprout
bash scripts/aws_lifesprout.sh
```

## Update After Pushing New Code

```bash
bash scripts/aws_lifesprout.sh --pull
```

## Public URL

Default script behavior configures nginx, so the app URL is:

```text
http://<YOUR_EC2_PUBLIC_IP>/
```

The app continues running after the terminal is closed because PM2 manages the Node server.

## Required AWS Security Group

Open inbound:

- SSH `22` for administration
- HTTP `80` for the app

You do not need public `5173` in the AWS build flow. You do not need public `3001` unless you run the script with `--no-nginx`.

## Runtime Data

Accounts and groups are stored in JSON files under `server/data`. This is MVP storage for one EC2 instance, not production database storage.

## Keys

Create or edit `server/.env` on the EC2 machine. Never push real keys.

```bash
nano server/.env
pm2 restart lifesprout --update-env
```

## Health Checks

```bash
pm2 status
pm2 logs lifesprout
sudo nginx -t
sudo systemctl status nginx --no-pager
```