# AWS Deployment Guide for Plant Bro

This guide provides step-by-step instructions on how to deploy the Plant Bro application to an AWS EC2 instance, configure your environment variables (API keys), and ensure the application runs continuously.

## 1. Selecting and Launching an AWS Instance

1. Log in to your [AWS Management Console](https://aws.amazon.com/console/).
2. Navigate to the **EC2 Dashboard** and click **Launch Instance**.
3. **Name your instance:** Give it a recognizable name (e.g., `PlantBro-Server`).
4. **Choose an Amazon Machine Image (AMI):** Select **Ubuntu Server 24.04 LTS** (or 22.04 LTS). It's widely used, free-tier eligible, and easy to configure.
5. **Choose an Instance Type:** 
   - Select **t2.micro** or **t3.micro**. These are eligible for the AWS Free Tier and should be sufficient for running a basic web application.
6. **Key Pair (Login):**
   - Click **Create new key pair**.
   - Give it a name (e.g., `plantbro-key`).
   - Keep the default settings (RSA, .pem).
   - Click **Create key pair**. **Important:** Download this `.pem` file and keep it safe; you will need it to connect to your server.
7. **Network Settings:**
   - Check **Allow SSH traffic from** (Anywhere or your IP).
   - Check **Allow HTTP traffic from the internet**.
   - Check **Allow HTTPS traffic from the internet**.
8. **Configure Storage:** The default 8GB is usually fine, but you can increase it up to 30GB within the free tier if needed.
9. Click **Launch Instance**.

## 2. Connecting to Your Instance

1. Go to your EC2 Instances list and select your new instance. Copy its **Public IPv4 address**.
2. Open your terminal (or PowerShell/Command Prompt on Windows).
3. Navigate to the folder where you downloaded your `.pem` key file.
4. Set the correct permissions for your key so only you can read it (AWS requires this):
   - **For Mac/Linux:**
     ```bash
     chmod 400 plantbro-key.pem
     ```
   - **For Windows (PowerShell):**
     Run these commands one by one to remove inherited permissions and grant read access only to your user:
     ```powershell
     icacls.exe plantbro-key.pem /reset
     icacls.exe plantbro-key.pem /grant:r "$($env:username):(r)"
     icacls.exe plantbro-key.pem /inheritance:r
     ```
5. Connect to the instance via SSH:
   ```bash
   ssh -i "plantbro-key.pem" ubuntu@<YOUR_EC2_PUBLIC_IP>
   ```

## 3. Preparing the Server Environment

Once connected to your Ubuntu server, update its packages and install Node.js and Git:

```bash
# Update package list
sudo apt update && sudo apt upgrade -y

# Install Node.js and npm (using NodeSource setup for version 20 LTS)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify installation
node -v
npm -v

# Install Git
sudo apt install git -y
```

## 4. Uploading Your Code to the Server

The best way to get your code onto the server is by using Git. 

1. From your local machine, push your `Plant_bro` project to a repository on GitHub (it can be private).
2. On your EC2 instance, clone your repository:
   ```bash
   git clone <YOUR_GITHUB_REPO_URL>
   cd Plant_bro
   ```
   *(If your repo is private, you might need to generate an SSH key on the Ubuntu server using `ssh-keygen` and add it to your GitHub account).*

## 5. Setting Up the Environment and API Keys

You need to place your API keys on the server securely. **Do not** upload your local `.env` file to GitHub.

1. Navigate to your server folder:
   ```bash
   cd server
   ```
2. Create a new `.env` file using the nano text editor:
   ```bash
   nano .env
   ```
3. Paste all your required environment variables into this file. It should look just like your local file:
   ```env
   PORT=3000
   YOUR_API_KEY=your_actual_api_key_here
   # Add any other keys you need here
   ```
4. Press `Ctrl + O` to save, `Enter` to confirm, and `Ctrl + X` to exit the nano editor.
5. Install backend dependencies:
   ```bash
   npm install
   ```
6. Complete the same process for your frontend if it requires a `.env` file for API base URLs:
   ```bash
   cd ../client
   nano .env
   npm install
   ```

## 6. Running the App Continuously (Using PM2)

To keep your application running round-the-clock even when you close your SSH terminal, use **PM2**, a production process manager for Node.js.

1. Install PM2 globally:
   ```bash
   sudo npm install -g pm2
   ```

2. **Start the Backend:**
   ```bash
   cd ~/Plant_bro/server
   pm2 start index.js --name "plantbro-backend"
   ```

3. **Start the Frontend:**
   *Note: For production, it's highly recommended to build the React app (`npm run build`) and serve static files. However, to run exactly what you have locally:*
   ```bash
   cd ~/Plant_bro/client
   pm2 start "npm run dev -- --host" --name "plantbro-frontend"
   ```

4. **Ensure PM2 restarts on server reboot:**
   ```bash
   pm2 startup
   ```
   *PM2 will format a specific command in the terminal output that you need to copy and paste to run. Run it.*
   Then save the current PM2 list:
   ```bash
   pm2 save
   ```

## 7. Opening Custom Ports (AWS Security Groups)

If your backend is running on port `3000` and your frontend on `5173`, AWS blocks these ports by default. You must allow them.

1. Go back to your AWS EC2 console, select your instance.
2. Click the **Security** tab in the bottom panel, then click on the active security group link (e.g., `sg-0abcd1234`).
3. Click **Edit inbound rules**.
4. Click **Add rule**:
   - Type: **Custom TCP**
   - Port range: **3000**
   - Source: **Anywhere-IPv4** (0.0.0.0/0)
5. Click **Add rule** again:
   - Type: **Custom TCP**
   - Port range: **5173** (or whatever port your Vite frontend outputs)
   - Source: **Anywhere-IPv4** (0.0.0.0/0)
6. Click **Save rules**.

You should now be able to view your fully running app by visiting: 
`http://<YOUR_EC2_PUBLIC_IP>:5173`
