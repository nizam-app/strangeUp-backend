# ADR-003 — Separate Digital Membership Billing from Physical Commerce

**Status:** PROPOSED.  
**Problem:** StrangeUp UI includes in-app Club memberships and physical merch checkout. Platform rules, provider receipts, tax, fulfillment and refunds differ.  
**Proposal:** independent Membership/Entitlement and PhysicalCommerce/Order domain models. Maintain server-verified purchase events, no client-trusted entitlement grants, no saving card/CVV.  
**Evidence:** screen exports #12, #42 (digital subscription), #13–15 (physical goods); platform rules checked on 2026-10-26.  
**Unresolved:** launch markets, exact products/price/tax/trial, alternative billing exceptions, which provider to integrate.  
**Policy references:** https://developer.apple.com/app-store/review/guidelines/ and https://support.google.com/googleplay/android-developer/answer/10281818?hl=en .
