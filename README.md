# Email Template Management System

## Overview

This project is a web-based application built using **SAPUI5 (Frontend)** and **SAP RAP (Backend)**.
The system allows users to manage email templates, preview HTML content, send emails, and track email logs efficiently.

---

## Objectives

* Provide a flexible system to manage email templates
* Allow users to preview email content before sending
* Track sent emails for auditing and debugging purposes
* Simulate real-world email campaign workflows

---

## Features

* Create / Edit / Delete Email Templates
* Preview HTML Email Content
* Send Email (Mock / API Integration)
* View Email Logs
* View Email Log Details (including HTML content)

---

## System Architecture

* **Frontend:** SAPUI5 (MVC Architecture)
* **Backend:** SAP RAP (OData Service)
* **Data Flow:**
  UI5 → OData Service → RAP → Database

---

## Business Flow

1. Create Email Template
2. Preview Email Content
3. Send Email
4. Save Email Log
5. View Email Log Details

---

## Project Structure

```
project-root/
│
├── webapp/              # SAPUI5 Frontend
│   ├── controller/
│   ├── view/
│   ├── model/
│   └── fragment/
│
├── srv/                 # Backend (RAP Services)
├── package.json
├── ui5.yaml
└── README.md
```

---

## Installation & Run

### 1. Clone repository

```bash
git clone https://github.com/syxdiejen/GSP26_SAP490_Capstone.git
cd email-template-system
```

### 2. Install dependencies

```bash
npm install
```

### 3. Run project

```bash
npm start
```

## Notes

* This project currently uses **mock data** for development
* Backend integration with **SAP RAP** can be extended in future versions

---

## Team Members

| Name                  | Role               |
| ----------------------| ------------------ |
| Dang Tai              | Frontend Developer |
| Bui Minh Duy          | Backend Developer  |
| Tran Dang Minh Quan   | UI/UX              |
| Nguyen Thinh Dat      | Tester             |

---

##  Future Improvements

* Integrate real email service (SMTP / API)
* Add template variables (dynamic placeholders)
* Improve UI/UX based on SAP Fiori standards
* Add authentication & authorization

---

## License

This project is developed for academic purposes at FPT University.
