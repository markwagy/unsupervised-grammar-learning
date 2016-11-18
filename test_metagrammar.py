from unittest import TestCase
from metagrammar import *


class TestMetaGrammar(TestCase):
    def test_consume_sequence(self):
        metagram = MetaGrammar(['-x;x-y;y-'])
        seq = list('abab')
        lhs = 'S'
        metagram.consume_sequence(seq, lhs)
        self.assertEqual(len(metagram.match_records), 1)


class TestPatternTeamplateDef(TestCase):
    def test_check(self):
        self.assertFalse(PatternTemplateDef.check('x-y'))
        self.assertFalse(PatternTemplateDef.check('x-y;y-'))
        self.assertFalse(PatternTemplateDef.check('y-;x-y'))
        self.assertFalse(PatternTemplateDef.check('-y;x-y'))
        self.assertFalse(PatternTemplateDef.check('x-y;-x'))
        self.assertTrue(PatternTemplateDef.check('-x;x-y;y-'))


