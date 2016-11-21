from unittest import TestCase
from metagrammar import *


class TestMetaGrammar(TestCase):
    def test_consume_sequence_1(self):
        metagram = MetaGrammar(['-x;x-y;y-'])
        seq = list('abab')
        lhs = 'S'
        metagram.consume_sequence(seq, lhs)
        metagram.print_match_records()
        self.assertEqual(len(metagram.match_records), 2)

    def test_consume_sequence_2(self):
        metagram = MetaGrammar(['-x;x-*;*-'])
        seq = list('ababcx')
        lhs = 'S'
        metagram.consume_sequence(seq, lhs)
        metagram.print_match_records()
        self.assertEqual(len(metagram.match_records), 4)

    def test_consume_sequence_3(self):
        metagram = MetaGrammar(['-x;x-x;x-'])
        seq = list('ababcx')
        lhs = 'S'
        metagram.consume_sequence(seq, lhs)
        metagram.print_match_records()
        self.assertEqual(len(metagram.match_records), 1)


class TestPatternTeamplateDef(TestCase):

    def test_check(self):
        self.assertFalse(PatternTemplateDef.check('x-y'))
        self.assertFalse(PatternTemplateDef.check('x-y;y-'))
        self.assertFalse(PatternTemplateDef.check('y-;x-y'))
        self.assertFalse(PatternTemplateDef.check('-y;x-y'))
        self.assertFalse(PatternTemplateDef.check('x-y;-x'))
        self.assertTrue(PatternTemplateDef.check('-x;x-y;y-'))
        self.assertTrue(PatternTemplateDef.check('-x;x-*;*-'))

