# Final AWS Deployment Guide for LifeSprout (Plant Bro)

This document serves as the complete, from-scratch guide to deploying the Plant Bro application on an AWS EC2 instance. It also details the initial failures we encountered regarding SSH keys and how we pivoted to a much more reliable approach using AWS EC2 Instance Connect.

---

## 🛑 The Initial Approach (And Why It Failed)

Initially, we attempted to connect to the AWS Ubuntu EC2 instance locally from a Windows PowerShell terminal using the downloaded `.pem` private key. 

### What Failed:
Windows file permissions for SSH keys are notoriously strict. AWS requires the `.pem` file to be readable *only* by the owner, completely stripping all inherited permissions. When we attempted to use PowerShell commands (`icacls`, `Get-Acl`, `Set-Acl`) to lock down the `plantbro-key.pem` file, Windows locked out the terminal entirely resulting in **"Access is denied"** and **"Permission denied (publickey)"** errors. Using the Windows `ssh-agent` also failed due to service permission restrictions. 

### The Changed Approach:
To completely bypass local Windows permission headaches, we switched to **AWS EC2 Instance Connect**. This is a browser-based, secure terminal built directly into the AWS Console that allows direct SSH access to the server without needing to manage local `.pem` keys.

---

## ✅ The Final, Successful Deployment Steps

Here are the complete, scratch-to-finish steps we used to get the project live.

### 1. Launching the EC2 Instance
1. In the AWS Console, launch a new **Ubuntu Server 24.04 LTS** (or 22.04) instance.
2. Select a `t2.micro` or `t3.micro` instance type (Free Tier eligible).
3. Under Network Settings, ensure **Allow HTTP traffic** and **Allow HTTPS traffic** from the internet are checked.
4. Launch the instance.

### 2. Connecting to the Server (The Fix!)
1. Go to the **EC2 Dashboard** and click **Instances (running)**.
2. Select your newly created instance.
3. Click the **Connect** button at the top right.
4. Choose the **EC2 Instance Connect** tab.
5. Make sure the username is `ubuntu` (or `ec2-user` for Amazon Linux).
6. Click the orange **Connect** button to open the browser-based terminal.

### 3. Server Setup (Installing Dependencies)
Inside the EC2 browser terminal, update the server and install Node.js, Git, and PM2 (our process manager):

```bash
# Update Ubuntu package list
sudo apt update && sudo apt upgrade -y

# Install Node.js (Version 20) and Git
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs git

# Install PM2 globally to run the app in the background forever
sudo npm install -g pm2
```

### 4. Fetching the Code
Instead of uploading files manually, we cloned the code directly from the GitHub repository:

```bash
git clone https://github.com/MJPL013/LifeSprout.git
cd LifeSprout
```

### 5. Backend Setup & API Keys
We installed the backend dependencies and securely created the `.env` file directly on the server (to prevent exposing keys on GitHub).

```bash
cd server
npm install
```

**Creating the `.env` file:**
We created the environment file containing the Gemini API key and configuration:

```bash
cat << 'EOF' > .env
GEMINI_API_KEY=your_gemini_api_key_here
USE_OLLAMA=false
PORT=3001
TICK_INTERVAL_MS=5000
EOF
```

**Starting the Backend:**
We used PM2 to start the backend so it runs in the background continuously:
```bash
pm2 start index.js --name "lifesprout-backend"
```

### 6. Frontend Setup
Next, we navigated to the client directory, installed its dependencies, and started the React/Vite development server. 

```bash
cd ../client
npm install
```

**Starting the Frontend:**
We used the `--host` flag to ensure the frontend is accessible from the public internet, not just `localhost`.
```bash
pm2 start "npm run dev -- --host" --name "lifesprout-frontend"
```

### 7. Ensuring PM2 Survives Server Reboots
To guarantee the app comes back online automatically if AWS restarts the server:

```bash
pm2 save
pm2 startup
```
*(Crucially: After running `pm2 startup`, it generates a specific `sudo ...` command in the terminal output. This generated command must be copied and executed to finish the setup!)*

### 8. Opening the Ports (AWS Security Groups)
By default, AWS blocks traffic to custom ports. We had to open ports `3001` (Backend) and `5173` (Frontend) in the AWS Console.

1. In the AWS Console -> EC2 Instances, select the instance.
2. Go to the **Security** tab at the bottom and click the Security Group link.
3. Click **Edit inbound rules** -> **Add rule**.
4. Allow **Custom TCP** on Port **5173** from Source **0.0.0.0/0** (Anywhere IPv4).
5. Allow **Custom TCP** on Port **3001** from Source **0.0.0.0/0** (Anywhere IPv4).
6. Save rules.

### 9. Accessing the Live App
The application is now accessible via the server's public IP address. 
Ensure you use `http://` instead of `https://` to avoid browser security blockages:
`http://<YOUR_EC2_PUBLIC_IP>:5173`

---

## 📝 Future Maintenance

### Checking App Status
```bash
pm2 status   # View running processes and memory usage
pm2 logs     # View live error logs and console output
```

### Updating API Keys (Adding DeepSeek)
If you ever need to add new keys (like DeepSeek) or change existing ones:

1. Open the EC2 Instance Connect browser terminal.
2. Navigate to the server folder: `cd ~/LifeSprout/server`
3. Edit the `.env` file using Nano:
   ```bash
   nano .env
   ```
4. Add the new key (e.g., `DEEPSEEK_API_KEY=your_key_here`).
5. Save and exit (`Ctrl+O`, `Enter`, `Ctrl+X`).
6. Restart the backend process so it picks up the new key:
   ```bash
   pm2 restart lifesprout-backend
   ```

### Troubleshooting: "Port 5173 is in use, trying another one (5174)"
If you run PM2 multiple times without stopping it, Vite will silently bump your frontend to port `5174` because `5173` is "in use" by a ghost process.
If this happens, the link `http://<YOUR_EC2_PUBLIC_IP>:5173` will stop working.

**To fix this and reset PM2 completely:**
1. Stop and delete all PM2 processes:
   ```bash
   pm2 stop all
   pm2 delete all
   ```
2. Force-kill any lingering Node processes hogging the port:
   ```bash
   sudo killall node
   ```
3. Restart the backend and frontend PM2 commands from scratch (Steps 5 and 6).
4. Save the stable PM2 list: `pm2 save`
