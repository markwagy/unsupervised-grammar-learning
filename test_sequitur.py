from unittest import TestCase
from sequitur import Sequitur


class TestSequitur(TestCase):
    def test_run_basic(self):
        seq = list('abcdbc')
        Sequitur.run(seq)
        self.assertEqual(True, True)

    #def test_run_basic2(self):
    #    seq = list('bcbcbcbcabcabcabdfbcdfbdfa')
    #    Sequitur.run(seq)
    #    self.assertEqual(True, True)
