# 🔎 MetroScan

### Legal Metrology Compliance & Inspection System

> **Scan. Extract. Evaluate. Verify.**

MetroScan is a web-based inspection and decision-support prototype designed to assist inspectors in screening **packaged commodities** against key declaration requirements under India's **Legal Metrology (Packaged Commodities) framework**.

The system processes package images through OCR, converts detected text into structured declarations, evaluates those declarations using a deterministic rule engine, and presents an evidence-backed inspection summary for human verification.

---

## 🚀 Overview

Manual inspection of packaged commodities often requires checking multiple declarations across different sides of a package.

MetroScan streamlines the initial screening process through a structured pipeline:

    ┌─────────────────────┐
    │   Package Images    │
    └──────────┬──────────┘
               │
               ▼
    ┌─────────────────────┐
    │    Image Upload     │
    └──────────┬──────────┘
               │
               ▼
    ┌─────────────────────┐
    │    OCR Processing   │
    └──────────┬──────────┘
               │
               ▼
    ┌─────────────────────┐
    │ Declaration         │
    │ Extraction          │
    └──────────┬──────────┘
               │
               ▼
    ┌─────────────────────┐
    │ Deterministic       │
    │ Rule Engine         │
    └──────────┬──────────┘
               │
               ▼
    ┌─────────────────────┐
    │ Compliance          │
    │ Assessment          │
    └──────────┬──────────┘
               │
               ▼
    ┌─────────────────────┐
    │ Evidence &          │
    │ Inspection Summary  │
    └─────────────────────┘

The goal is not to replace an inspector.

Instead, MetroScan helps an inspector **identify potentially relevant declarations, surface possible issues, and verify evidence faster.**

---

# ✨ Key Features

## 📷 Multi-Image Package Scanning

Inspectors can upload multiple images of the same package.

Supported package views can include:

- Front
- Back
- Side
- Top
- Bottom

This allows information distributed across different package surfaces to be considered together.

---

## 🔤 OCR-Based Text Detection

MetroScan processes uploaded package images using OCR.

The OCR stage captures:

- Extracted text
- OCR confidence
- Source image
- Image role

OCR processing is handled independently for each uploaded image, allowing the system to continue processing even when an individual image encounters an error.

---

## 🧾 Structured Declaration Extraction

Raw OCR output is converted into structured product declarations.

The current prototype extracts information such as:

| Declaration | Description |
|---|---|
| Product / Generic Name | Name or generic description of the product |
| Manufacturer | Manufacturer declaration |
| Packer | Packer declaration |
| Importer | Importer declaration |
| Address | Responsible entity address |
| Net Quantity | Quantity and unit |
| MRP | Maximum Retail Price |
| Consumer Care | Consumer support/contact information |
| Country of Origin | Country of origin declaration |

The extracted information is represented using a typed `ProductDeclaration` structure.

---

# ⚖️ Deterministic Compliance Engine

MetroScan does **not** use an LLM to directly decide whether a package is compliant.

Instead, extracted declarations are passed through a deterministic TypeScript rule engine.

### Current Prototype Rules

| Rule ID | Requirement |
|---|---|
| `PC-001` | Product / Generic Name |
| `PC-002` | Manufacturer / Packer / Importer |
| `PC-003` | Address |
| `PC-004` | Net Quantity |
| `PC-005` | Maximum Retail Price (MRP) |
| `PC-006` | Consumer Care Details |
| `PC-007` | Country of Origin |

Each rule produces one of four statuses:

    PASS
    FAIL
    REVIEW
    NOT CHECKED

### Status Meaning

| Status | Meaning |
|---|---|
| 🟢 **PASS** | A valid-looking declaration was detected |
| 🔴 **FAIL** | Detected information appears invalid or insufficient |
| 🟠 **REVIEW** | Human verification is recommended |
| ⚪ **NOT CHECKED** | Applicability could not be established |

---

# 🔍 Evidence-Based Inspection

Every rule result can expose the evidence used during evaluation.

The inspection panel can show:

- Rule ID
- Rule title
- Status
- Decision message
- Detected value
- OCR confidence
- Raw OCR text
- Source image
- Source image role

Example:

    PC-005  Maximum Retail Price (MRP)

    PASS

    MRP detected as a valid positive value (₹120).

    Detected value:
    120

    OCR confidence:
    94%

    Evidence:
    "MRP ₹120/-"

    Source:
    back-label.jpg
    (BACK)

This makes automated screening more transparent and easier to verify.

---

# 🚨 Issues Requiring Attention

MetroScan highlights rules that require additional attention.

    ┌─────────────────────────────────────┐
    │ ISSUES REQUIRING ATTENTION          │
    ├─────────────────────────────────────┤
    │                                     │
    │ 🔴 PC-004  Net Quantity             │
    │    FAIL                             │
    │    Quantity detected without a      │
    │    recognized unit.                 │
    │                                     │
    │ 🟠 PC-007  Country of Origin        │
    │    REVIEW                           │
    │    Importer detected but country    │
    │    of origin was not identified.    │
    │                                     │
    └─────────────────────────────────────┘

FAIL and REVIEW results receive additional visual emphasis so an inspector can quickly identify areas that need manual verification.

---

# 🧑‍💼 Human-in-the-Loop

MetroScan is designed around a **human-in-the-loop inspection model**.

    AUTOMATED
        │
        ▼
    Image Processing
        │
        ▼
        OCR
        │
        ▼
    Declaration
    Extraction
        │
        ▼
    Rule Evaluation
        │
        ▼
    Evidence-Based
        Result
        │
        ▼
       HUMAN
    VERIFICATION

The system assists with detection and screening.

The inspector remains responsible for final verification.

---

# 🆔 Inspection Summary

Each completed scan generates a temporary inspection reference.

The inspection summary contains:

- Inspection ID
- Timestamp
- Number of images scanned
- Overall status
- PASS count
- FAIL count
- REVIEW count
- NOT CHECKED count

Example:

    MetroScan Inspection

    Inspection ID: INS-2026-08-26-A7K2
    Date: 26/08/2026, 8:30 PM
    Images Scanned: 3

    Overall: REVIEW REQUIRED

    PASS: 4
    FAIL: 1
    REVIEW: 2
    NOT CHECKED: 0

The inspection ID is generated client-side for prototype demonstration.

It is **not stored in a database** in the current version.

---

# 📋 Copy Inspection Summary

The inspection result can be copied to the clipboard using the built-in:

**Copy Inspection Summary**

This makes it easy to transfer results into:

- Inspection notes
- Reports
- Documentation
- Manual audit records
- Demonstration workflows

---

# 🧠 Why Deterministic Rules?

Compliance systems need to be explainable.

Instead of asking an AI model:

> "Is this package legally compliant?"

MetroScan separates **detection** from **evaluation**.

    OCR / Detection
          │
          ▼
    Structured Data
          │
          ▼
    Explicit Rules
          │
          ▼
    Compliance Status
          │
          ▼
    Human Verification

This provides several advantages:

- Predictable results
- Reproducible decisions
- Easier debugging
- Better explainability
- Traceable evidence
- Reduced dependence on generative AI hallucinations

AI/OCR can help identify information.

The deterministic rule engine evaluates the detected information.

---

# 🏗️ System Architecture

    ┌───────────────────┐
    │   Package Images  │
    └─────────┬─────────┘
              │
              ▼
    ┌───────────────────┐
    │   ImageUploader   │
    └─────────┬─────────┘
              │
              ▼
    ┌───────────────────┐
    │    OCR Engine     │
    │    Tesseract      │
    └─────────┬─────────┘
              │
      OCR text + confidence
              │
              ▼
    ┌───────────────────┐
    │   Deterministic   │
    │     Extractor     │
    └─────────┬─────────┘
              │
              ▼
    ┌───────────────────┐
    │ ProductDeclaration│
    └─────────┬─────────┘
              │
              ▼
    ┌───────────────────┐
    │ Compliance Rule   │
    │      Engine       │
    └─────────┬─────────┘
              │
              ▼
    ┌───────────────────┐
    │ ComplianceReport  │
    └─────────┬─────────┘
              │
              ▼
    ┌──────────────────────────────┐
    │     Inspection Dashboard     │
    │                              │
    │ • Status                     │
    │ • Evidence                   │
    │ • Confidence                 │
    │ • Issues                     │
    │ • Inspection Summary         │
    └──────────────────────────────┘
              │
              ▼
    ┌───────────────────┐
    │ Human Verification│
    └───────────────────┘

---

# 🛠️ Technology Stack

### Frontend

- **Next.js**
- **React**
- **TypeScript**
- **Tailwind CSS**
- **Lucide React**

### Processing

- **Tesseract.js / OCR**
- Deterministic TypeScript extraction
- Deterministic compliance rule engine

### Architecture

The current prototype is primarily client-side.

There is currently:

- No database
- No authentication system
- No backend dependency
- No external compliance API
- No LLM dependency for compliance decisions

This keeps the prototype lightweight and suitable for rapid demonstration.

---

# 📁 Project Structure

    metroscan/
    │
    ├── app/
    │   ├── page.tsx
    │   ├── globals.css
    │   │
    │   └── scanner/
    │       └── page.tsx
    │
    ├── components/
    │   └── scanner/
    │       ├── ImageUploader.tsx
    │       ├── OCRResults.tsx
    │       ├── DeclarationPanel.tsx
    │       └── CompliancePanel.tsx
    │
    ├── lib/
    │   ├── ocr.ts
    │   ├── inspection.ts
    │   │
    │   ├── extraction/
    │   │   ├── schema.ts
    │   │   ├── deterministicExtractor.ts
    │   │   └── normalize.ts
    │   │
    │   └── rules/
    │       ├── types.ts
    │       ├── packagedCommodityRules.ts
    │       └── evaluateCompliance.ts
    │
    ├── public/
    │
    ├── package.json
    ├── tsconfig.json
    ├── next.config.ts
    └── README.md

---

# 🔄 Inspection Workflow

### Step 1 — Upload

The inspector uploads one or more images of the package.

Possible views:

- Front
- Back
- Side
- Top
- Bottom

### Step 2 — OCR

MetroScan extracts visible text from each image.

**Image → OCR → Text + Confidence + Source**

### Step 3 — Declaration Extraction

OCR output is processed to identify relevant declarations.

**OCR Text → Pattern / Field Extraction → ProductDeclaration**

### Step 4 — Compliance Evaluation

The structured declaration is evaluated using the rule engine.

**ProductDeclaration → Compliance Rules → RuleResult[] → ComplianceReport**

### Step 5 — Inspection Review

The inspector receives:

- Overall status
- Individual rule results
- Detected values
- Evidence
- OCR confidence
- Source information
- Issues requiring attention

### Step 6 — Human Verification

The inspector verifies the automated result against the actual package before taking any enforcement action.

---

# 📊 Current Prototype Coverage

| Feature | Status |
|---|---|
| Image Upload | ✅ |
| Multi-Image Processing | ✅ |
| OCR | ✅ |
| OCR Confidence | ✅ |
| Structured Declaration Extraction | ✅ |
| Manufacturer Detection | ✅ |
| Packer Detection | ✅ |
| Importer Detection | ✅ |
| Address Detection | ✅ |
| Net Quantity Detection | ✅ |
| MRP Detection | ✅ |
| Consumer Care Detection | ✅ |
| Country of Origin Detection | ✅ |
| Deterministic Rule Engine | ✅ |
| PASS / FAIL / REVIEW | ✅ |
| NOT CHECKED State | ✅ |
| Evidence Display | ✅ |
| Inspection ID | ✅ |
| Inspection Timestamp | ✅ |
| Inspection Summary | ✅ |
| Copy Summary | ✅ |
| Issues Requiring Attention | ✅ |
| Human Verification Disclaimer | ✅ |
| Database | ⏳ Future Scope |
| Persistent Inspection History | ⏳ Future Scope |
| PDF Export | ⏳ Future Scope |

---

# 🚀 Getting Started

## Prerequisites

Make sure you have installed:

- Node.js
- npm
- Git

## Clone the Repository

    git clone <YOUR-METROSCAN-REPOSITORY-URL>
    cd metroscan

## Install Dependencies

    npm install

## Start Development Server

    npm run dev

Open:

**http://localhost:3000**

---

# 🧪 Verification

Run TypeScript validation:

    npx tsc --noEmit

Run the production build:

    npm run build

Start the production server:

    npm start

---

# 🖥️ Demo Flow

For a live demonstration, the recommended flow is:

1. Open MetroScan
2. Start Scanner
3. Upload package images
4. Run OCR
5. Show detected text
6. Show structured declarations
7. Show compliance assessment
8. Open Issues Requiring Attention
9. Inspect evidence and OCR confidence
10. Copy Inspection Summary
11. Explain human verification

This demonstrates the complete pipeline without requiring external infrastructure.

---

# 🎯 Design Philosophy

MetroScan follows five core principles.

### 1. Explainability

Every automated result should be understandable.

### 2. Evidence First

Detected information should be connected to its source whenever possible.

### 3. Human-in-the-Loop

Automation assists the inspector rather than replacing the inspector.

### 4. Deterministic Evaluation

Compliance rules should be explicit and reproducible.

### 5. Lightweight Prototype

The system avoids unnecessary infrastructure during the prototype stage.

---

# 🔐 Privacy & Data Handling

The current prototype does not implement persistent inspection storage.

Inspection metadata such as the temporary inspection ID and timestamp is generated client-side.

No permanent inspection database is required for the current prototype workflow.

Future production deployments would require appropriate:

- Data retention policies
- Access control
- Encryption
- Audit logging
- Privacy controls
- Secure storage

---

# ⚠️ Limitations

MetroScan is currently a prototype.

OCR performance can be affected by:

- Low image quality
- Blur
- Poor lighting
- Curved packaging
- Small text
- Stylized fonts
- Reflections
- Occlusion
- Complex layouts

Similarly, deterministic extraction may fail when declarations are presented in unexpected formats.

A `REVIEW` result therefore does not necessarily mean that a package is non-compliant.

It means that the available automated evidence is insufficient for an automatic conclusion.

---

# 🔮 Future Scope

## Advanced OCR

- Image preprocessing
- Perspective correction
- Better low-light recognition
- Multilingual OCR
- Regional language support
- Multiple OCR engines

## Improved Extraction

- Better declaration classification
- Layout-aware extraction
- Cross-image field matching
- Confidence-aware extraction
- Advanced normalization

## Expanded Compliance Engine

Future versions can extend the deterministic rule engine to cover:

- Additional mandatory declarations
- Category-specific requirements
- Additional quantity/unit validation
- Date-related declarations
- Packaging-specific requirements
- Additional Legal Metrology rules

## Inspector Platform

Potential production features:

- Inspector authentication
- Persistent inspection records
- Inspection history
- Search and filtering
- Case management
- Review and approval workflows
- PDF reports
- Digital audit trails

## Advanced Evidence

Future versions could provide:

- OCR bounding boxes
- Highlighted declaration regions
- Click-to-source evidence
- Image overlays
- Side-by-side evidence verification

---

# 📈 Product Vision

MetroScan can evolve from a prototype screening tool into a broader **digital inspection assistant**.

    TODAY
      │
      ▼
    Package Scanning
      │
      ▼
    OCR + Extraction
      │
      ▼
    Rule-Based Screening
      │
      ▼
    Human Verification
      │
      ▼
    FUTURE
      │
      ▼
    Persistent Inspections
      │
      ▼
    Digital Case Files
      │
      ▼
    Evidence Management
      │
      ▼
    Inspector Dashboard
      │
      ▼
    Analytics & Reporting

---

# 🏆 Smart India Hackathon

MetroScan is being developed as a prototype for **Smart India Hackathon 2026**.

The project focuses on using software automation, OCR, structured extraction, and explainable rule-based evaluation to improve the initial screening of packaged commodities.

---

# 👥 Team

**Project:** MetroScan

**Track:** Legal Metrology / Packaged Commodity Compliance

**Purpose:** Smart India Hackathon 2026 Prototype

---

# 📜 Disclaimer

> MetroScan is an AI-assisted decision-support prototype intended for demonstration and innovation purposes.
>
> The results generated by the system are **not a legally binding determination of compliance**.
>
> OCR and automated extraction may be incomplete or inaccurate. Compliance results must be independently verified by a qualified inspector against the actual packaged commodity and applicable legislation before any enforcement or legal action.

---

# 📌 Project Status

**Current Stage:** Functional SIH Prototype

**Core Pipeline:** Complete

**Compliance Engine:** Prototype

**Production Deployment:** Future Scope

---

# 🔎 MetroScan

### Scan → Extract → Evaluate → Verify

Built for faster, clearer and more explainable packaged commodity inspection.