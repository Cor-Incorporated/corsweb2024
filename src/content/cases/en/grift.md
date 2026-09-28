---
title: "Grift — Turning scattered customer requests into specifications a development team can build from"
description: "A look at Grift, our in-house product that structures unformed requests with AI and turns them into requirements, estimates, and actionable work packets."
category: "grift"
tags: ["Grift", "AI", "Requirements definition", "Contract development"]
publishedAt: 2026-06-30
summary: "In contract development, the rationale behind an estimate tends to live with one person. Grift is an AI product that assembles reference estimates you can explain, based on track records and market rates, structuring scattered requests into requirements, estimates, and work packets."
isDraft: false
featured: true
lang: "en"
translationSourceHash: "3520564b3040fbb4162ae1d2e5348686126a9493aef5807d32907bf016ad34ee"
translatedAt: "2026-09-28T06:09:16.029Z"
translationModel: "adopted-legacy"
---

## Challenge

On contract development projects, what the customer actually wants is, in most cases, not yet put into words at the point of intake. Fragments of requests are scattered across inquiry forms, chat threads, and meeting minutes, and the development team reads through them by hand and translates them into requirements. A great deal of time was dissolving into this first round of organizing.

There is a second problem, one we held as a party to it ourselves: the basis for an estimate. Even on similar projects, the way a figure is arrived at can vary with the experience and instinct of whoever is handling it, and there were moments when we could not fully explain to the customer or to the team why the number came out as it did. An estimate that depends on one person becomes a black box the moment the veteran leaves. Grift is the product that came out of trying to solve these two problems at once.

## Approach

Rather than handling unformed text as it stands, we designed the system to move through stages with AI: decomposing intent, filling in missing information, then structuring the result. Humans keep the final judgement while AI takes on the mechanical organizing, which is how we aim to reduce oversights and rework.

On estimates too, we did not have the AI simply produce a figure. The design philosophy is to build a reference estimate on top of material such as past track records and market rates, in a form where a human can explain why the number comes out as it does. Rather than handing everything to AI and calling it done, we hold the line that the final judgement and the accountability stay with people.

## Implementation

AI analyses the raw text that comes in and breaks it down into units of change requests. Missing information is surfaced as follow-up questions, and once the answers are in, the completeness is scored. Requests that are sufficiently complete are converted into requirements, estimates, and work packets, and output in a form the development team can pick up directly.

When generating an estimate, the system matches structured requirements against material such as past track records and a sense of market rates, and presents a reference estimate with its rationale attached. What we care about in this product is that the team can check not only the figure but also what the figure is based on. Grift is currently in the Team Beta stage, being validated on real projects inside and outside the company, and is also introduced at [griftai.org](https://griftai.org).

## Results

The organizing-in-order-to-organize that used to occur at the intake of a project has been compressed, and the development team can now spend more time confirming requirements and making implementation decisions. Communication with the customer has also become less prone to misalignment, because what is settled and what is still open is made visible.

Being able to put the basis for an estimate into words has made it possible to share judgements that used to depend on an individual, and to hand them over. Grift itself is still a product under validation, but the idea of an estimate that is not simply handed off to AI is exactly the problem we face day to day on contract development projects. We want to grow it first in our own workplace, and bring it out into the world once we can speak to it with confidence.
