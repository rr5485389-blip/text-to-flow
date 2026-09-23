export interface SampleText {
  id: string;
  name: string;
  category: string;
  description: string;
  content: string;
}

export const SAMPLE_TEXTS: SampleText[] = [
  {
    id: 'auth-flow',
    name: 'User Authentication & MFA Security Flow',
    category: 'Security / Auth',
    description: 'Login sequence, biometric challenge, MFA code verification, and session token generation.',
    content: `SYSTEM WORKFLOW SPECIFICATION: USER AUTHENTICATION & MULTI-FACTOR VERIFICATION

1. TRIGGER:
User opens mobile/web client and navigates to the login screen.

2. STEP 1 - CREDENTIAL SUBMISSION:
The user enters their registered email address and password on the Login Screen.
The client validates format and encrypts payload before sending to Authentication Gateway.

3. STEP 2 - GATEWAY & RATE LIMITING:
API Gateway inspects IP address and rate limit bucket.
- IF request rate > 10 requests/min: Return 429 Too Many Requests screen and trigger IP temporary lock.
- ELSE: Forward to Identity Provider Service.

4. STEP 3 - CREDENTIAL VERIFICATION:
Identity Provider verifies hashed password against PostgreSQL Auth Store.
- IF password invalid: Increment failed attempts counter and return Error Dialog "Invalid Credentials".
- IF failed attempts >= 5: Lock account and dispatch Security Alert Email.
- IF password valid: Check if Multi-Factor Authentication (MFA) is enabled for user profile.

5. STEP 4 - MFA CHALLENGE:
- IF MFA is NOT enabled: Issue JWT Access Token & Refresh Token, redirect user to User Home Dashboard.
- IF MFA IS enabled: Generate time-based one-time password (TOTP) / SMS code and transition user to MFA Verification Screen.

6. STEP 5 - MFA CODE VALIDATION:
User inputs 6-digit TOTP code on the MFA Screen.
- IF code is valid: Generate secure session, record audit log in Security DB, and transition user to User Home Dashboard.
- IF code expired or invalid: Prompt user with "Invalid Code" banner, allow resend after 60s cooldown.`
  },
  {
    id: 'checkout-fulfillment',
    name: 'E-Commerce Checkout & Payment Routing',
    category: 'E-Commerce',
    description: 'Shopping cart checkout, address validation, Stripe payment intent, inventory reservation, and warehouse dispatch.',
    content: `SPECIFICATION: E-COMMERCE CHECKOUT & INVENTORY RESERVATION ENGINE

1. FLOW START:
Customer clicks "Proceed to Checkout" from the Shopping Cart UI.

2. STAGE 1 - ORDER REVIEW & ADDRESS SELECTION:
Customer lands on Checkout Screen.
Selects shipping address and shipping tier (Standard vs Express).
System calculates shipping rates and local tax via TaxJar API.

3. STAGE 2 - INVENTORY LOCK:
Order Service invokes Inventory Cluster to place a 15-minute reservation lock on selected SKU items.
- IF any SKU out of stock: Redirect customer back to Cart with "Item Stock Changed" warning modal.
- ELSE: Reserve stock units and render Payment Options Section.

4. STAGE 3 - PAYMENT AUTHORIZATION:
Customer inputs credit card or selects Apple Pay on the Payment Screen.
Payment Service communicates with Stripe/Payment Gateway to authorize funds.
- IF payment fails (insufficient funds, fraud flagged): Display "Payment Declined" card with retry option; release inventory lock after 15 mins.
- IF payment succeeds: Capture transaction ID, create Order record in Orders Database with status "PAID".

5. STAGE 4 - NOTIFICATION & FULFILLMENT:
- Email Service dispatches Order Confirmation Receipt to customer.
- Warehouse Management System (WMS) receives auto-generated packing slip and logistics label.
- Customer is navigated to Order Success Confirmation Screen with real-time tracking link.`
  },
  {
    id: 'customer-support-ai',
    name: 'AI Customer Ticket Triage & Resolution',
    category: 'Operations & AI',
    description: 'Inbound customer inquiry, sentiment evaluation, AI auto-response or human agent escalation.',
    content: `BUSINESS LOGIC: CUSTOMER SUPPORT TICKET TRIAGE & ESCALATION

1. TRIGGER:
Customer submits a support inquiry via the In-App Help Center Form or Live Chat Widget.

2. STEP 1 - INGESTION & NLP PARSING:
Ticket Ingestion Worker receives inquiry payload.
Gemini Sentiment & Intent Analyzer inspects message body:
- Detects category (Billing, Technical Issue, Feature Request, Account Cancellation).
- Calculates urgency score (Low, Medium, Critical).

3. STEP 2 - ROUTING DECISION:
- IF category is "Billing" AND amount < $50:
  Automated Refund Agent checks customer refund eligibility.
  - IF eligible: Issue Stripe refund credit, update Billing DB, send Success Notification to customer.
  - IF ineligible: Route ticket to Senior Financial Specialist.
- IF category is "Account Cancellation" OR urgency score is "Critical":
  Trigger Immediate Slack alert to Customer Retention Team and assign to Tier 2 Human Agent.
- IF category is "Technical Issue":
  AI Knowledge Base searches documentation and proposes immediate self-service solution in Chat UI.
  - IF user clicks "This solved my problem": Close ticket with status RESOLVED.
  - IF user clicks "Still need help": Transfer conversation to On-Duty Technical Representative.`
  },
  {
    id: 'document-approval',
    name: 'Enterprise Contract Approval & Signing Flow',
    category: 'Enterprise / Legal',
    description: 'Document upload, AI compliance check, manager approval matrix, and e-signature dispatch.',
    content: `PROCESS FLOW: ENTERPRISE CONTRACT APPROVAL WORKFLOW

1. INITIALIZATION:
Procurement Officer uploads vendor agreement PDF/DOC on Contract Upload Screen.

2. PRE-CHECK & COMPLIANCE SCAN:
Document Parser extracts legal clauses, payment terms, and vendor liability limits.
Automated Rule Engine tests contract against Corporate Policy DB:
- IF liability cap < $1,000,000 OR payment terms > Net 60:
  Flag compliance breach, mark contract as "RED_FLAG", and notify Legal Counsel.
- ELSE: Mark status as "POLICY_COMPLIANT".

3. MULTI-TIER APPROVAL MATRIX:
- Tier 1: Department Manager reviews contract summary on Approval Dashboard.
  - IF rejected: Return to submitter with revision notes.
  - IF approved AND contract value <= $25,000: Skip to E-Signature Stage.
- Tier 2: IF contract value > $25,000:
  Route contract to Chief Financial Officer (CFO) for financial risk sign-off.

4. E-SIGNATURE DISPATCH:
DocuSign API delivers envelope to Vendor Representative and Internal Signatory.
Upon reciprocal electronic signing, store encrypted copy in S3 Document Vault.
Notify all stakeholders and update ERP Vendor Ledger.`
  }
];
