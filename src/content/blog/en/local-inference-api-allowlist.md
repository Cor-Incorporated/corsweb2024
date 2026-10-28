---
title: "What Companies Must Protect in a World Where Local APIs Lack Authentication: Operating with Allow-Lists"
description: "Many tools that run local inference are designed for local use. For example, Ollama's localhost API does not require authentication. Kousuke Terada, CEO, discusses the discrepancies in permission settings that often remain after expanding to internal networks, the proper order for onboarding and decommissioning devices, and a generalized checklist."
summary: "Many tools that run local inference are built on the assumption that they will be used locally; for instance, Ollama's localhost API does not require authentication. With unauthenticated APIs, reachability essentially means usability, making lingering listening ports and permission discrepancies after expanding to internal networks a significant risk. Rather than just tracking vulnerability information, we believe it is essential to first formalize procedures for the order of device onboarding and decommissioning—registering to the ledger first during onboarding, and revoking permissions first during decommissioning."
pubDate: 2026-10-28
author: "Terisuke"
category: "ai"
ctaIntent: "confidential-ai-assessment"
tags: ["ローカルLLM", "Ollama", "情報セキュリティ", "ISMS"]
lang: "en"
featured: false
isDraft: false
translationSourceHash: "8378f2b839ed91057711bc8a65de4ef18e4426757c35c9541be542e7b342702c"
translatedAt: "2026-10-27T13:40:22.021Z"
translationModel: "gemini-3.8-flash"
---

Hello, this is Terada from Cor.Inc. Today's topic is a bit understated. But if you are running local AI internally, it is probably the thing that matters most.

## Local Inference APIs Are Designed Assuming "Local Machine Use"

Many tools that run inference locally start from the premise that they will be used on the local machine in front of you.

For example, the official Ollama documentation states that the local API on localhost does not require authentication. It also states that by default, it listens locally (127.0.0.1), and you can change the listening interface through settings.

This is not so much a flaw as a design assumption. For use on a local machine, that is sufficient. Problems arise when you extend this assumption to your internal corporate network.

## "Internal Only" Is Not the Name of a Perimeter

When setting up an inference server for internal use, you widen the listening address so other devices can use it. You use a firewall to decide which devices are allowed to reach it. Up to this point, it is standard procedure.

What requires caution is what comes after.

A listening configuration opened for testing is left as is. A permission temporarily added remains indefinitely. A permission for a device no longer in use remains in the firewall, even though it was removed from the ledger.

With an unauthenticated API, "being able to reach it" effectively means "being able to use it." Therefore, the very state where unintentional devices could reach it becomes a risk. The phrase "internal only" only has meaning when accompanied by actual, concrete permission settings.

## What to Do Before Checking CVEs

Tracking vulnerability information (CVEs) is important. But I believe there is something that should be made into a standard procedure before that: the sequence for onboarding and decommissioning devices.

Vulnerabilities surface all at once on a given day. Discrepancies in permission settings accumulate little by little every day. Without a procedure, no one will notice the latter.

## Onboarding Sequence

When allowing a new device to use the inference API, we follow this sequence:

1. Register the device in the ledger (purpose, person in charge, expiration date)
2. Check the basic configuration on the device side
3. Add it to the firewall allowlist
4. Confirm reachability and record the verification date in the ledger

Ledger first, permissions second. This order is essential. If permissions are added first, you will not be able to trace later "whose permission this is, and what it was for."

## Decommissioning Sequence

When removing a device, we do the reverse:

1. Remove it from the firewall allowlist
2. Confirm that it can no longer be reached
3. Clean up credentials and settings on the device side
4. Update the ledger to "Decommissioned" and record the date

Here, deleting the permission first is essential. Updating only the ledger while leaving the permission in place is the most common discrepancy that occurs.

## A Generalized Checklist

Here is a summary that can be applied to other companies, rather than being specific to our own cases:

- Is the inference API's listening address restricted to the intended scope?
- Have listening configurations broadened for testing been reverted after testing?
- Does the firewall allowlist match the device ledger?
- For each allowed destination, are the purpose, person in charge, and expiration date recorded in the ledger?
- During decommissioning, are tasks processed in the order of "remove permission → confirm unreachable → update ledger"?
- Is a cross-check between the allowlist and the ledger conducted periodically (for example, monthly)?
- Are logs kept showing who added or removed which permissions, and when?
- If an unauthenticated API must be exposed externally, is it designed with authentication or access control placed in front of it?

None of these are glamorous. However, if this checklist is actively maintained, most discrepancies will be caught early.

## What We Do

Cor.Inc. provides hands-on support for all-local implementations running on existing devices. Within our ISMS operations, we work together with you on architecture selection, as well as the design of permissions, revocations, and logging. For our ISMS, we completed the ISO/IEC 27001 Stage 2 audit in October 2026, and expect certification registration around December 2026.

The allowlist management discussed here sits right at the core of those "revocations" and "logging." Rather than comparing speed or performance, we believe the true value lies in continuously maintaining these understated boundaries.

## In Conclusion

Hearing that there is no authentication might make you uneasy. However, that simply means understanding the tool's underlying assumptions. Once you understand the assumptions, what needs to be protected becomes clear.

Whose device is allowed to reach it, starting from when, and until when? Being able to account for that in both your ledger and your permission settings—that is what we aim to safeguard.

## References

- [Ollama Docs: Authentication](https://docs.ollama.com/api/authentication) - Description stating that the local API on localhost (port 11434) does not require authentication (verified on October 27, 2026)
- [Ollama Docs: FAQ](https://docs.ollama.com/faq) - Under "How can I expose Ollama on my network?". Description stating that by default it listens on 127.0.0.1 port 11434, and the listening interface can be changed via the environment variable `OLLAMA_HOST` (verified on October 27, 2026)
- [Cor.Inc.: Security](https://cor-jp.com/security/) - Details on our ISMS operations, completing the ISO/IEC 27001 Stage 2 audit in October 2026, and expecting certification registration around December 2026
