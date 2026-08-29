# 📰 News Aggregator with AI

A personal news aggregation platform that consolidates multiple RSS feeds, uses AI to summarize articles, and allows you to ask questions about news content.

## Features

- ✅ Aggregate news from multiple RSS feeds
- ✅ AI-powered article summarization (powered by Grok)
- ✅ Interactive Q&A with articles
- ✅ Clean, responsive dashboard
- ✅ Cloudflare Workers backend
- ✅ No database needed

## Tech Stack

- **Backend**: Cloudflare Workers
- **Frontend**: HTML, CSS, JavaScript
- **AI**: Grok API (Groq)
- **Hosting**: Cloudflare Pages (Dashboard) + Cloudflare Workers (Backend)

## Setup

### Prerequisites

- GitHub account
- Cloudflare account
- Grok API key from https://console.groq.com/

### Installation

1. Clone this repository
2. Deploy Worker to Cloudflare
3. Deploy Dashboard to Cloudflare Pages
4. Set up Grok API key in Cloudflare secrets

## TODO

- [ ] Add user preferences for news categories
- [ ] Store summarization history
- [ ] Add email notifications
- [ ] Build mobile app
- [ ] Add more AI models

## License

MIT
