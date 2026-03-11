# Symposium Quiz Application - Frontend ( )

This is the frontend for the MERN Stack Symposium Quiz Application, built with React, Vite, and Tailwind CSS.

## Features
- Secure Registration and Login via JWT
- Responsive layout across devices
- Micro-animations and modern aesthetics

## Guides

### Admin Guide
Admins have elevated privileges to manage quizzes and monitor the progress of participants.

**1. Creating a Quiz:**
- Log in using an Admin account (Role set to `admin` during registration).
- Navigate to the **Admin Dashboard**.
- On the "Manage Quizzes" tab, enter a **Quiz Title**, set a **Duration (in minutes)**, and select a **Start Time**.
- Click **Create Quiz**. The quiz will now appear under "Active Quizzes".

**2. Adding Questions:**
- Switch to the **Add Questions** tab in the Admin Dashboard.
- Select the Quiz you want to add questions to from the dropdown. 
- Enter the **Question Text**.
- Provide exactly 4 **Options** for the multiple-choice question.
- Write the **Correct Answer** exactly as it appears in one of your 4 options.
- Click **Add Question**.

**3. Viewing Results:**
- Switch to the **View Results** tab to see all submitted quizzes across all users.
- Results format shows the student's name, the specific quiz they took, their score, and the submission date.

### Participant (User) Guide
Participants use the platform to take quizzes during the symposium.

**1. Joining a Quiz:**
- Register or log in with a normal User account (Role set to `user` or Participant).
- Only quizzes marked as "Active" by the Admin will appear on your **User Dashboard**.
- Click the **Join Quiz** button on an available quiz.

**2. Taking the Quiz:**
- The quiz interface will display questions sequentially. Question order is randomized!
- A **Timer** at the top will count down. The timer continues even if you accidentally reload the page.
- Choose one correct option for each question.
- **Do not submit early unless you are done**. If the timer hits `00:00`, the quiz will auto-submit.

**3. Leaderboards and Scoring:**
- After submitting, you will instantly see your **Score**.
- Click **Check Leaderboard** to see how you rank among other participants. The leaderboard tracks the all-time scores for symposium participants.

## Getting Started Setup

1. Make sure the Node.js backend is running.
2. In this frontend folder, ensure your dependencies are installed:
   ```bash
   npm install
   ```
3. Start the Vite development server:
   ```bash
   npm run dev
   ```
4. Access the web interface at `http://localhost:5173/`.
