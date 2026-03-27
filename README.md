# BMI Mail Client

Welcome to the BMI Mail Client! This is a modern, fast, and feature-rich email application designed to give you full control over your inbox. It connects directly to your IMAP and SMTP servers, securely syncing your messages and letting you send out communications with ease.

## What is inside?

This application was built from the ground up to be beautiful and easy to use. Here are some of the things you can do:

* **Real-time Email Sync:** Bring your inbox right to your screen.
* **Modern Compose Window:** Write emails seamlessly with support for attachments, CC, and BCC.
* **Multi-Account Support:** Do you manage multiple email addresses? You can log into up to 10 accounts and switch between them effortlessly.
* **Folder Management:** Move your emails between folders to keep things organized.
* **Smart UI:** Toggle between a gorgeous Light and Dark mode depending on your preference.
* **Secure Authentication:** Built on top of Firebase to keep your sessions secure.

## Tech Stack

We put this together using some of the best tools available:

* **Frontend:** React, Tailwind CSS, Lucide Icons, Vite
* **Backend:** Express, Node.js, Vercel Serverless Functions
* **Email Protocols:** ImapFlow (for reading), Nodemailer (for sending), Mailparser (for reading attachments and rich text)
* **Database & Auth:** Firebase

## Getting Started Locally

Do you want to run this application on your own computer? It is quick and straightforward!

### 1. Requirements
Make sure you have Node.js installed on your machine.

### 2. Installation
Clone the repository, navigate into the folder, and run the following command to download all necessary packages:

\\\ash
npm install
\\\

### 3. Environment Variables
If you need to connect this to your own Firebase setup or customize the SMTP/IMAP host details, look inside the server components or create a \.env\ file to store your secrets safely.

### 4. Run the development server
Start up the local environment and see the magic on localhost!

\\\ash
npm run dev
\\\

## Deployment

This app is ready to be hosted wherever you prefer. It includes configuration so it deploys smoothly on modern hosting providers like Vercel. 

Thanks for dropping by, and happy emailing!
