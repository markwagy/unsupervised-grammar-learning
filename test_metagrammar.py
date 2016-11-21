from unittest import TestCase
from metagrammar import *


class TestMetaGrammar(TestCase):

    def test_consume_sequence_1(self):
        pat = 'xy'
        metagram = MetaGrammar([pat])
        s = 'abab'
        print("\n\nSTRING: %s, PATTERN: %s" % (s, pat))
        seq = list(s)
        lhs = 'S'
        metagram.consume_sequence(seq, lhs)
        metagram.print_match_records()
        self.assertEqual(len(metagram.match_records), 2)

    def test_consume_sequence_2(self):
        pat = 'x*'
        metagram = MetaGrammar([pat])
        s = 'ababcx'
        print("\n\nSTRING: %s, PATTERN: %s" % (s, pat))
        seq = list(s)
        lhs = 'S'
        metagram.consume_sequence(seq, lhs)
        metagram.print_match_records()
        self.assertEqual(len(metagram.match_records), 4)

    def test_consume_sequence_3(self):
        pat = 'xyx'
        metagram = MetaGrammar([pat])
        s = 'ababcx'
        print("\n\nSTRING: %s, PATTERN: %s" % (s, pat))
        seq = list(s)
        lhs = 'S'
        metagram.consume_sequence(seq, lhs)
        metagram.print_match_records()
        self.assertEqual(len(metagram.match_records), 2)


class TestPatternTemplate(TestCase):

    def test_consume_1(self):
        pattem = PatternTemplate('xy')
        self.assertTrue(pattem.consume_sequence('ab'))

    def test_consume_2(self):
        pattem = PatternTemplate('xyx')
        self.assertTrue(pattem.consume_sequence('aba'))
        self.assertFalse(pattem.consume_sequence('abc'))

    def test_consume_3(self):
        pattem = PatternTemplate('xy*y')
        self.assertTrue(pattem.consume_sequence('abab'))
        self.assertFalse(pattem.consume_sequence('abux'))
        self.assertTrue(pattem.consume_sequence('abub'))
        self.assertFalse(pattem.consume_sequence('ab'))