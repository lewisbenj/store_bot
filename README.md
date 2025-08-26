# Mystvale Bot

A Discord bot designed to enhance your server with marriage, love points, and currency features. Built with Node.js and Discord.js, this bot allows users to engage in virtual marriages, send love messages, manage coins, and more!

## Features

- **Marriage System**:
  - Propose marriage with a ring (`vmry @user <ring_id>`).
  - View marriage details (`vmarry`) including wedding date and days passed.
  - Divorce with confirmation (`vdc`, `vcf`, `vdf`).
  - Customize marriage photos (`vsetphoto`, `vsetanhnho`, `vsetanhlon`).
- **Love Points**:
  - Send love messages to your partner (`v love`) with cooldown (10 minutes).
  - Earn love points and bonus coins/owo based on ring bonuses.
  - Check love points and currency (`vlovepoints`).
- **Currency Management**:
  - Buy rings from two shops using MystCoin (MC) or Owo (`vshop1`, `vshop2`, `vbuy <ring_id>`).
  - Check inventory (`vinv`) and bank balance (`vbank`).
  - Transfer MystCoin to others (`vbank @user <amount>`) with confirmation.
- **Admin Features**:
  - Add MystCoin for users (owner only, `vowner @user <amount>`).
- **Help and Utility**:
  - View all commands (`vhelp` or case-insensitive variants like `Vhelp`).
  - Case-insensitive prefix support (e.g., `vhelp`, `Vhelp`, `VHELP`).

## Installation

### Prerequisites
- Node.js (version 18 or higher recommended).
- A Discord bot token (create one via the [Discord Developer Portal](https://discord.com/developers/applications)).
- Git (optional, for cloning the repository).

### Steps
1. **Clone the Repository**:
   ```bash
   git clone https://github.com/your-username/mystvale-bot.git
   cd mystvale-bot
   ```

2. **Install Dependencies**:
   - Run the following command to install required Node.js packages:
     ```bash
     npm install dotenv discord.js express
     ```
   - This installs `dotenv` (for environment variables), `discord.js` (for Discord integration), and `express` (for potential server setup).

3. **Configure Environment Variables**:
   - Create a `.env` file in the project root.
   - Add the following variables:
     ```
     TOKEN=your_discord_bot_token
     OWNER_ID=your_discord_user_id
     ```
   - Replace `your_discord_bot_token` with your bot token and `your_discord_user_id` with your Discord user ID.

4. **Initialize Data Files**:
   - The bot will automatically create `bot_data.json` and `user.json` to store marriage, inventory, and currency data when it runs for the first time.

## Running the Bot

### Locally
1. **Start the Bot**:
   - Run the following command in the terminal:
     ```bash
     node index.js
     ```
   - The bot will log in and display a "Ready!" message with its username.

2. **Invite the Bot to Your Server**:
   - Use the OAuth2 URL from the Discord Developer Portal (with `bot` and `applications.commands` scopes) to invite the bot to your server.

### Deploying (Optional)
- For 24/7 hosting, consider platforms like **Render** or **Heroku**.
  - **Render**: Follow Render's guide to deploy as a Web Service or Background Worker with `node index.js` as the start command.
  - **Heroku**: Use a `Procfile` with `worker: node index.js` and deploy via Git.

## Usage
- Use the prefix `v` (case-insensitive) followed by command names (e.g., `vhelp`, `Vmarry`).
- Check the `vhelp` command for a full list of available commands and their descriptions.

## Contributing
Feel free to fork this repository, submit issues, or create pull requests to improve the bot!

## License
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Author
Benjamon Lewis:
https://lewisbenj.netlify.app/
---
