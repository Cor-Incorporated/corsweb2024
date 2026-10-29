---
title: "Before using a local inference API inside the company: designing authentication, an allow list and device retirement"
description: "Before using a local inference API inside the company, design authentication, an allow list and device retirement as separate things. An allow list shows which peer may be reached. Who may use it for which work is decided separately."
summary: "The official description of Ollama says the localhost API does not require authentication. An allow list shows which peer the traffic may reach. That alone does not decide who may use it for which work. Responding to vulnerabilities and managing allow rules are not alternatives that replace each other."
pubDate: 2026-10-28
updatedDate: 2026-10-29
author: "Terisuke"
category: "ai"
ctaIntent: "confidential-ai-assessment"
tags: ["ローカルLLM", "Ollama", "情報セキュリティ", "ISMS"]
lang: "en"
featured: false
isDraft: false
translationSourceHash: "1cfc6850c3470817cd6d66514c2be11bd1793eeda737c01c8f5359034ae4d502"
translatedAt: "2026-10-29T05:20:00.000Z"
translationModel: "manual-i18n-sync"
---

Hello, this is Terada from Cor.Inc. Today's subject is plain. If you run local AI inside a company, it is something to decide first.

## Built for use on the machine in front of you

Many tools that run inference locally assume, first, that they are used on the machine in front of you.

Ollama's official documentation says, for example, that the local API on localhost does not require authentication. It also says that, by default, it listens on local 127.0.0.1, and that the listen address can be changed in settings.

This is less a defect than a design premise. For use on the machine in front of you, that premise is enough. The problem starts when that premise is carried onto the company network.

Calling a local API and having the whole process finish on that machine are not the same thing. Depending on the model you choose, some setups send traffic outside. Check the chosen model and the outbound traffic as well.

## The word "internal"

When you stand up an inference server for internal use, you widen what it listens on so other devices can reach it. A firewall decides which devices may reach it. Up to here, this is an ordinary procedure.

What needs care is what comes after.

A listen address opened as a trial stays open. An allow entry added for a short time stays. A device that is no longer used is gone from the register, but the firewall still allows it.

On an API without authentication, "it can be reached" almost means "it can be used." So a state in which an unintended device can still reach it is itself a risk. The words "internal only" mean something only when the actual allow rules go with them.

## What an allow list tells you

An allow list tells you which peer the traffic may reach. That alone does not decide who may use it for which work. When several people use it, authentication in front, permissions per user or service, and what happens on revocation are items to design separately. This is not a report that Cor.Inc. has finished implementing them.

## Vulnerability response and allow rules

Responding to vulnerabilities and managing allow rules are not things that one of the two can finish alone. Besides following update notices, keep checking which device may connect, for which purpose, and until when.

Vulnerability information (CVEs) arrives in a batch on some day. Drift in allow rules accumulates a little every day. The latter is hard to notice without a procedure. Both belong in the procedure.

## Order of acceptance

When a new device is allowed to use the inference API, Cor.Inc. uses this order for acceptance.

1. Register the device in the register (purpose, owner, end date)
2. Check the device's basic settings
3. Add it to the firewall allow list
4. Confirm that it can be reached, and record the date in the register

The register comes first and the allow rule after. If only the allow rule is added first, you can no longer trace whose permission it was, or for what.

## Order of retirement

When a device is removed, the order is reversed.

1. Remove it from the firewall allow list
2. Confirm that it can no longer be reached
3. Clear credentials and settings on the device
4. Mark the register row as retired and keep the date. Do not delete the row; keep it as history

The allow rule is removed first. Updating only the register while the allow rule remains is the drift that happens most easily.

When compromise is suspected, that is separate from the retirement steps above. Isolation and revocation of credentials come first. A suspect device is not handled by the ordinary retirement order.

## Items to check

This is not a single incident. It is written so other companies can use the same shape. No measured values are listed here. The time until a revocation takes effect is decided as a requirement. A measured value is written only when it has been measured.

- Is the inference API's listen address limited to the intended range?
- Was a listen address widened for a test put back after the test?
- Does the firewall allow list match the device register?
- Does the register have a purpose, an owner and an end date for each allow entry?
- On retirement, is the order "remove the allow rule, confirm it cannot be reached, update the register"?
- Is the allow list checked against the register on a regular cadence (for example monthly)?
- Is there a record of who added or removed which allow rule, and when?
- If an API without authentication must be exposed, is there a design that puts authentication or access control in front?
- Besides success from an allowed device, is an unallowed device refused?
- After revocation, is it refused?
- What happens when the service is stopped?
- Are the chosen model and the outbound traffic within the range you assumed?

If this list is in use, drift is easier to notice. That does not mean every drift is found.

## What we look at together

Cor.Inc. starts from existing equipment and looks together at the range to process locally. Within ISMS operations, we work together on choosing a setup and on designing permissions, revocation and logs. The ISMS completed the ISO/IEC 27001 stage 2 audit in October 2026, and certification registration is expected around December 2026.

This allow-list subject sits in that talk of revocation and logs. Being able to explain which device may reach the API, and until when, is an operating condition in addition to inference performance. Performance requirements are not denied here.

## What can be explained

Hearing that there is no authentication may feel unsettling. That only means the tool's premise is now known. Once the premise is known, the range to protect becomes visible.

Whose device may reach it, from when, and until when. Being able to explain that in both the register and the allow rules is what Cor.Inc. wants to keep. An allow list alone does not decide a user's permissions.

## References

- [Ollama Docs: Authentication](https://docs.ollama.com/api/authentication) - the local API on localhost (port 11434) does not require authentication (checked on 27 October 2026)
- [Ollama Docs: FAQ](https://docs.ollama.com/faq) - the section "How can I expose Ollama on my network?". By default it listens on 127.0.0.1 port 11434, and the environment variable `OLLAMA_HOST` changes the listen address (checked on 27 October 2026)
- [Cor.Inc.: Security](https://cor-jp.com/security/) - that an ISMS is operated, that the ISO/IEC 27001 stage 2 audit was completed in October 2026, and that certification registration is expected around December 2026
