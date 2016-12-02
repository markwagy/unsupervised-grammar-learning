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

    def test_replace_all_instances(self):
        sym = Symbol('X', False)
        l1 = [Symbol(x, True) for x in [1, 2, 1, 2]]
        self.assertListEqual(MetaGrammar.replace_all_instances(l1, l1[0:2], sym), [sym, sym])
        l2 = [Symbol(x, True) for x in [1, 2, 0, 2]]
        self.assertListEqual(MetaGrammar.replace_all_instances(l2, l2[0:2], sym),
                             [sym, Symbol(0, True), Symbol(2, True)])
        l3 = [Symbol(x, True) for x in [0, 2, 0, 2]]
        self.assertListEqual(MetaGrammar.replace_all_instances(l3, l2[0:2], sym), l3)
        self.assertListEqual(MetaGrammar.replace_all_instances([0, 2, 0, 2], [0, 2, 0], sym), [sym, 2])
        self.assertListEqual(MetaGrammar.replace_all_instances([0, 2, 0, 2, 1, 2, 0, 1, 2], [1, 2], sym),
                             [0, 2, 0, 2, sym, 0, sym])


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

    def test_get_uid(self):
        for i in range(30):
            print(i)
            PatternTemplate.get_uid()
        self.assertTrue(True)
