---
title: "Adding Examples Can Make Some Prompts Worse: Testing Generative AI with a Small LLM"
description: "On October 29, 2026, at an internal corporate study session led by Representative Kousuke Terada, we tested two techniques on a small language model (Qwen2.5-3B-Instruct): \"providing examples\" and \"asking for a review.\" Based on questions that improved, worsened, or confidently asserted an error was correct, we explain how to evaluate generative AI for business operations."
summary: "When testing with a small language model, providing examples solved some questions correctly while causing errors in others. When asked to review, it sometimes confidently asserted that an incorrect answer needed \"no correction.\" When testing generative AI, define the correct answers first, change only one variable at a time, run the same questions multiple times, and record both improved and worsened examples."
pubDate: 2026-10-30
author: "Terisuke"
category: "ai"
tags: ["生成AI", "ローカルLLM", "プロンプト", "AI導入", "勉強会"]
image:
  url: "/images/blog/llm-archaeology-few-shot-self-check.avif"
  alt: "An illustration showing dots connected by thin lines branching into two paths, with a blue check mark on one and an X mark on the other"
lang: "en"
featured: false
isDraft: false
translationSourceHash: "aab0a9e0fbfbd2911455d3c19e618f486edee679c6b94088a367d6987314057b"
translatedAt: "2026-10-30T03:03:16.979Z"
translationModel: "gemini-3.8-flash"
---

It is often said that generative AI "improves in accuracy when you provide examples" and "makes fewer mistakes when asked to review its work." Are you incorporating these techniques into your company's workflows without verifying their actual effectiveness?

On October 29, 2026, at an internal study session for a company where CEO Kousuke Terada served as the instructor, we tested these two techniques on a small language model. While providing examples made the model answer some questions correctly, the very same technique caused it to answer others incorrectly. When asked to review its work, the model even firmly stated "no corrections needed" on an incorrect answer. In this article, we share the results from that session and discuss how to evaluate generative AI when testing it for business tasks.

## What Is Happening

The study session was the final installment of a three-part series, conducted online in a 90-minute slot. Each participant experimented on their own PC using the identical model and settings. The results described here were verified on the instructor's PC.

- Model: Qwen2.5-3B-Instruct (Q4_K_M, approx. 2.1 GB)
- Application: LM Studio
- Settings: Context 4096, Temperature 0 (a setting that tends to produce the same answer each time), max tokens 1024

Today's chat AIs provide plausible answers even without special prompt engineering. Older models were limited, and humans compensated by tailoring their inputs. Those techniques were eventually incorporated into the models and systems themselves, leading to the chat AIs of today. In the study session, we traced this evolution using a small model—an approach modeled on "experimental archaeology," where one builds and tests historical tools firsthand.

### For Some Questions, Adding Examples Made the Answers Worse

The first technique is to show two examples of how to answer beforehand (Few-shot). We compared identical questions, changing only whether examples were provided or not.

The change calculation problem asked to compute the change from a 1,000-yen bill after buying 3 apples at 120 yen each and 4 mandarin oranges at 80 yen each. Without examples, the model correctly answered 320 yen, but with examples, it answered 680 yen. The 680 yen was the total cost of the purchase, which it confused with the change. In a question asking to extract the name, date, time, and number of people from a reservation text, the version with examples left the "(Thu)" from the original text in the date field.

On the other hand, in a question asking who among three people is the slowest, the model gave the wrong answer C without examples, but answered correctly with B when examples were added. Even with the exact same technique, the results can improve or worsen depending on the question.

### When Asked to Review, It Firmly Stated "No Corrections" on an Error

The second technique is asking the model to review its answer within the same conversation after responding (self-checking). In a question asking to sort five words in Japanese alphabetical (gojūon) order, the model kept the incorrect order and firmly stated "no corrections needed." In the three-person speed question, although it wrote the correct order of the three people halfway through the review, its final answer remained C.

### Answers Fluctuated Even with Identical Settings

Even when setting Temperature to 0, the answers after the review were not consistent. When the instructor tested the review process 8 times for the three-person speed question on their PC, the model arrived at the correct answer B only once.

The results up to this point are records of only 5 questions tested with a small 3B model on a single PC used by the instructor. We have not verified whether the same results would occur with today's large-scale chat AIs.

## Common Pitfalls

What happened with the small model closely mirrors the pitfalls encountered when testing generative AI for business operations.

### Mistaking Fluent Answers for Proof of Correctness

When an answer is fast and well-written, it looks correct. In the study session, we did not treat fluent explanations or responses like "I have verified this" as evidence; we compared only the final answer against the correct one.

### Changing Multiple Variables at Once

If you add examples, rephrase the prompt, and switch the model all at once, you will not know which change affected the result. In the study session, we changed only one variable at a time and started a fresh conversation for each condition. Only the review request was made consecutively within the same conversation.

### Deciding Based on a Single Result

As seen with the three-person speed question, some questions produce fluctuating answers even under identical settings. A single success or a single failure is not sufficient ground for making a decision.

### Keeping Only the Successful Examples

When trying out prompt techniques, people tend to remember only the improved results. As with the change calculation, a previously correct answer can turn into a mistake due to a prompt tweak.

## How to Proceed

When testing generative AI for business operations, following these steps makes it easier to explain what you have learned:

1. Select a few questions you actually want to delegate in your operations, and decide the correct answer or passing criteria beforehand.
2. Change only one condition at a time, and compare before and after the change side by side.
3. Repeat the same question multiple times.
4. Record the results across four metrics: content (is it correct?), format (did it follow the requested form?), completion (did it write through to the end?), and time; keep records of both improved and deteriorated examples.
5. Have a human look at the records to decide whether to adopt it and for which operations to use it.

We believe this evaluation approach can be applied in the same way even as models grow larger.

At Cor.Inc., we assist with generative AI and local LLM implementations and training. Through our services, we can help organize question selection and recording methods tailored to your business operations. You do not need to send real operational data, confidential documents, or credentials for an initial consultation.

## Summary

At the end of the study session, we reflected on what became of these two techniques. The technique of showing examples evolved into training models to follow instructions. The technique of asking for a review evolved into reasoning models that think before answering, as well as answer-verification systems. We concluded by noting that both are built into today's chat AIs. Even so, answering fluently and being correct remain two different things.

Examples and review requests can improve answers for some questions, but make them worse for others. When testing techniques, define the correct answer beforehand, change only one variable at a time, repeat the test multiple times, and record both improved and deteriorated cases. Whether to use the technology should be judged by humans looking at those records.

## References

- [Qwen2.5-3B-Instruct-GGUF (Qwen, Hugging Face)](https://huggingface.co/Qwen/Qwen2.5-3B-Instruct-GGUF)
- [LM Studio Docs](https://lmstudio.ai/docs/app)
- [Brown et al., "Language Models are Few-Shot Learners" (2020, arXiv:2005.14165)](https://arxiv.org/abs/2005.14165)
- [Ouyang et al., "Training language models to follow instructions with human feedback" (2022, arXiv:2203.02155)](https://arxiv.org/abs/2203.02155)
- [Huang et al., "Large Language Models Cannot Self-Correct Reasoning Yet" (2023, arXiv:2310.01798)](https://arxiv.org/abs/2310.01798)
