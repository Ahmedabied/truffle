"""Offline checks only. These tests never call Workers AI."""

import unittest

from run_baseline import extract_reply, validate_prompts
from summarize import state_fields, word_count


class BaselineTests(unittest.TestCase):
    def test_prompt_grid_and_mood_priority(self):
        prompts, digest = validate_prompts()
        self.assertEqual(len(prompts), 20)
        self.assertEqual(len(digest), 64)

    def test_separate_reasoning_is_not_final_content(self):
        raw = {"choices": [{"message": {"content": "Final answer", "reasoning": "Private analysis"}}]}
        reply, excluded = extract_reply(raw)
        self.assertEqual(reply, "Final answer")
        self.assertEqual(excluded[0]["source"], "message.reasoning")

    def test_null_reasoning_is_absent(self):
        reply, excluded = extract_reply({"choices": [{"message": {"content": "Hello", "reasoning": None}}]})
        self.assertEqual(reply, "Hello")
        self.assertFalse(excluded)

    def test_inline_thought_block_is_removed(self):
        reply, excluded = extract_reply({"response": "<think>Private analysis</think>Final answer"})
        self.assertEqual(reply, "Final answer")
        self.assertEqual(len(excluded), 1)

    def test_gemma_channel_is_removed(self):
        reply, excluded = extract_reply({"response": "<|channel>thought\nPrivate analysis<channel|>Final answer"})
        self.assertEqual(reply, "Final answer")
        self.assertEqual(len(excluded), 1)

    def test_truncated_thought_is_not_presented_as_answer(self):
        reply, excluded = extract_reply({"response": "<think>Unfinished analysis"})
        self.assertEqual(reply, "")
        self.assertEqual(excluded[0]["source"], "unclosed_thought_block")

    def test_state_echo_is_preserved_as_a_scored_defect(self):
        original = "[truffle energy=15%] Hello"
        reply, excluded = extract_reply({"response": original})
        self.assertEqual(reply, original)
        self.assertFalse(excluded)

    def test_bilingual_word_count_excludes_markdown_only(self):
        self.assertEqual(word_count("- ** hello مرحبا 30 🍄 ```"), 3)

    def test_fields_do_not_depend_on_output_key_order(self):
        first = '[truffle zero_days=2 burrowed=yes weather="44C apparent, Muscat"]'
        second = '[truffle weather="44C apparent, Muscat" burrowed=yes zero_days=2]'
        self.assertEqual(state_fields(first), state_fields(second))


if __name__ == "__main__":
    unittest.main()
