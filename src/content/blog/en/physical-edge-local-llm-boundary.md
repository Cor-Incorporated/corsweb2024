---
title: "Where to separate field AI and internal-document AI. Cor.Inc.'s design choice"
description: "Field AI that runs near cameras and sensors, and a local LLM that handles internal documents, care about different conditions. Cor.Inc.'s policy is to separate the verification environments. Separation itself is not proof of safety."
summary: "Field AI and internal-document AI can both be set up to limit sending data outside. That alone is not a reason to put them in the same environment. Cor.Inc.'s policy is to keep the physical-inference verification environment apart from the environment that handles internal documents. That is a design choice for explaining the connection and the blast radius, not proof of safety."
pubDate: 2026-10-28
updatedDate: 2026-10-29
author: "Terisuke"
category: "ai"
ctaIntent: "local-llm-poc"
tags: ["ローカルLLM", "エッジAI", "セキュアAI", "設計"]
lang: "en"
featured: false
isDraft: false
translationSourceHash: "d0513b1cfbfaeca13818fefd287ed9de99c213dc2ce077385996d97ce4a8a716"
translatedAt: "2026-10-29T05:20:00.000Z"
translationModel: "manual-i18n-sync"
---

Hello, this is Terada from Cor.Inc.

Where do you separate field AI and internal-document AI? In conversations about local AI, the two are sometimes spoken of as one thing.

One is AI that runs near cameras and sensors. The other is a local LLM that handles internal documents and business data.

Both can be set up to limit sending data to an external cloud. That alone does not mean they may be placed in the same environment. At Cor.Inc. we look separately at what each one connects to, what it handles, and how far the effect reaches if something goes wrong.

## Conditions that matter

For field AI, we look at the time from receiving an input to returning a judgment, and at what happens if communication drops. For uses that move a machine, being able to move to the safe side when something is abnormal is also essential. "It must not stop" is not the only correct answer.

What we look at together in the field is not stopping (availability), not being late (real-time behavior), and being able to stop safely when it is dangerous.

For AI that handles internal documents, who may refer to which document is a large issue. Can a permission be removed when the person in charge changes? Does a removed permission also apply to search and answers? Can a needed operation be checked afterwards?

Field AI also needs permission management. An internal LLM also needs response time and steady operation. The place the design watches most carefully is different.

## Trust boundary

Being on the same cluster is not a conclusion about whether something is dangerous. Being on different equipment is not proof that it is safe.

Even on the same platform, a boundary can be designed with network separation, authentication and authorization, and workload isolation. NIST zero trust is the idea of not trusting a physical place or a position on the network by itself.

If field equipment joins a single cluster with no conditions, the boundary becomes vague. If shared access rights, credentials and management paths are shared without checking the reason, the range of effect grows. Equipment placed in the field might reach close to internal documents.

On a diagram it is one thin line. In operation it is a large difference.

## How numbers are added up

Adding up device counts and speed numbers makes a document look impressive. At Cor.Inc. we do not add equipment that is running for another purpose into the device count of one system. We also do not combine measurements taken under different conditions. We keep it clear what a number measured. This is our own rule for totals. Other people's intentions are not written here.

If the boundary is vague, the next things cannot be explained. When this edge device stops, which uses of the internal LLM are affected? If this device's account is stopped, how far does the stop reach?

## The policy now

What Cor.Inc. chooses now is the following separation. It is a policy. It does not mean that being separated makes it safe.

- Physical-inference edge is designed as edge-only
- It is not placed on the main cluster of the internal local LLM
- In explanations to others, edge devices are not mixed into the main line's setup or performance
- When data is passed between them, the content and the path are decided one case at a time

There are requests to use a result from the edge on the business side. Even then we do not say "it can be read freely because it is on the same cluster."

## An example for explanation

Consider wanting to use an inspection result from the field in internal work. This is an example of a setup for explanation. It is not a feature Cor.Inc. has finished implementing, and it is not a customer case.

If the work can proceed with only an inspection ID, a time and a judgment, the whole video and a free connection to the field device might not need to be passed. If a use needs images, the need and the range are checked first.

We do not say "it can be read because it is in the same company." We say "only this content is passed because this use needs it." Whether a connection is refused after use is stopped, and how a stop on one side affects the other, are items to check for each setup. This article does not say that check is finished.

## What the simulation showed

At Cor.Inc. we use a task that moves the body, such as splitting a watermelon, as material for verifying physical inference. At present this is verification in simulation. The policy is to keep this verification environment apart from the environment that handles internal documents as well.

Even in an experiment, the handling of information is not left vague. What was confirmed in simulation is not treated as proof of safety or performance on a real machine. Safety and performance on a real machine need a separate check. That part is not yet confirmed.

## Performance and operation

Speed matters. If an answer does not come back within the needed time, it cannot be used for the work. Inference performance is where Cor.Inc. puts effort in research and development. Speed changes greatly with the environment and the use.

Speed alone does not decide whether it can be used for the work. Even if the answer is fast, it is a problem if a document that should not be seen appears, if use cannot be stopped, or if the response to a failure is not decided.

The aim is to meet the performance requirements and, in addition, to check together a setup that can be operated safely. That is not a guarantee that it can be operated safely in every environment.

Being able to explain who can use what, and until when. Designing the boundary, permissions, revocation and safety together.

Placing it locally does not make it safe automatically. Starting from existing equipment, we think about the range to process locally and a setup that fits the work.

## Range of responsibility

The cloud is also a shared-responsibility model. Access permissions and the management of data remain the user's responsibility from the start. How the responsibility is split differs by the form of the service. What is cited here is one example of the explanation AWS publishes.

Going local adds physical management and operation of the platform on top of that. The lines the company draws increase by that much. Keeping a state in which those lines can be explained one by one is what Cor.Inc. treats as important.

## State of the audit

Cor.Inc. operates an ISMS. In October 2026 it completed the ISO/IEC 27001 stage 2 audit. Certification registration is expected around December 2026. The state of the audit and what was verified on each system are told separately.

## Range of the connection

Separating field AI and internal-document AI is not for giving up on connecting them. It is for connecting only what is needed, in a form that has a reason.

Who can use what, and until when. What happens if the connection is stopped. When something goes wrong, how far does the effect reach. The policy is to carry that explanation past the diagram, to settings and to the results of checks. An item that does not yet have a check result is not written as if it did.

If you want to handle internal documents and field data with AI, but the range of the connection is not decided, please ask from an outline of the work and the current setup. The first contact does not need confidential documents or credentials.

## References

- [NIST SP 800-207: Zero Trust Architecture](https://csrc.nist.gov/pubs/sp/800/207/final) - the idea of not treating a position on the network as implicit trust (the overview was checked on 29 October 2026)
- [AWS: Shared Responsibility Model](https://aws.amazon.com/compliance/shared-responsibility-model/) - one example of how cloud responsibility is split. The split differs by the form of the service (checked on 29 October 2026)
- [Cor.Inc.: Security](https://cor-jp.com/security/) - that an ISMS is operated, that the ISO/IEC 27001 stage 2 audit was completed in October 2026, and that certification registration is expected around December 2026
