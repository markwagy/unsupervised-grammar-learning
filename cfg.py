import string
import random
import re
from collections import defaultdict
import collections


class Symbol:

    uid = 0

    def __init__(self, val, is_terminal):
        self.val = self.clean(val)
        self.is_terminal = is_terminal
        self.uid = Symbol.get_uid()

    def __str__(self):
        return "%s" % self.val if self.is_terminal else "<%s>" % self.val

    def __eq__(self, other):
        return self.val == other.val

    @staticmethod
    def get_uid():
        Symbol.uid += 1
        return Symbol.uid

    def clean(self, sym):
        return sym.replace("'", "")


class CFG:

    OR_SEP = '|'
    SYMBOL_SEP = ' '
    START_SYMBOL = '_S_'
    LHS_RHS_SEP = '->'

    def __init__(self):
        self.rules = defaultdict(lambda: '')
        self.initial_lhs = CFG.START_SYMBOL
        self.terminals = []

    def __str__(self):
        d = self.to_serializable()
        s = "%s %s %s\n" % (self.START_SYMBOL, CFG.LHS_RHS_SEP, CFG.OR_SEP.join([CFG.SYMBOL_SEP.join([str(x) for x in s])
                                                                          for s in self.rules[self.START_SYMBOL]]))
        keys_no_start = [ki for ki in filter(lambda k: k != self.START_SYMBOL, d.keys())]
        for k in sorted(keys_no_start):
            rhs_lst = self.rules[k]
            rhs_str = CFG.OR_SEP.join(CFG.SYMBOL_SEP.join([str(r) for r in rhs]) for rhs in rhs_lst)
            s += "%s %s %s\n" % (k, CFG.LHS_RHS_SEP, rhs_str)
        return s

    def add_from_tuple(self, rhs, lhs):
        self.rules[lhs.strip()] = []

    def get_next(self, lhs: Symbol) -> list:
        matches = self.match(lhs)
        return [r if r.is_terminal else self.get_next(r) for r in matches]

    def match(self, lhs: Symbol) -> list:
        if lhs.is_terminal:
            return lhs
        or_rules = self.rules[lhs.val]
        if len(or_rules) == 0:
            raise Exception("Can't find %s in the rules" % lhs.val)
        rule_choice = random.choice(or_rules)
        return rule_choice

    #@staticmethod
    #def is_terminal(val):
    #    return val.strip()[0] in string.ascii_lowercase

    @staticmethod
    def flatten(list_of_lists):
        for el in list_of_lists:
            if isinstance(el, collections.Iterable) and not isinstance(el, Symbol):
                yield from CFG.flatten(el)
            else:
                yield el

    def generate(self) -> list:
        if CFG.START_SYMBOL not in self.rules.keys():
            raise Exception("problem with initial rule")
        lols = self.get_next(Symbol(CFG.START_SYMBOL, is_terminal=False))
        flat_lols = list(CFG.flatten(lols))
        return ' '.join([f.val for f in flat_lols])

    @staticmethod
    def is_terminal(sym: Symbol) -> bool:
        return sym.strip()[0] in string.ascii_lowercase or "'" in list(sym)

    @staticmethod
    def parse_rhs_clauses(rhs_str):
        rhs_str_spl = rhs_str.split(CFG.SYMBOL_SEP)
        rhs = [Symbol(val=x, is_terminal=CFG.is_terminal(x)) for x in rhs_str_spl if len(x) > 0]
        return rhs

    def parse_rhs_or_clauses(self, rhs_ors):
        rhs_str_or = filter(lambda x: len(x) > 0, rhs_ors.split(CFG.OR_SEP))
        rhss = [self.parse_rhs_clauses(rhs_str) for rhs_str in rhs_str_or]
        return rhss

    def load_from_text(self, text):
        cleaned_text = re.sub(r"[!?.]", CFG.OR_SEP, text.lower())
        cleaned_text = re.sub(r"[^\w.!?%s ]" % CFG.OR_SEP, "", cleaned_text.strip())
        cleaned_text = re.sub(r"  *", " ", cleaned_text)
        self.rules[CFG.START_SYMBOL] = self.parse_rhs_or_clauses(cleaned_text)

    def load(self, filename):
        f = open(filename, 'r')
        for line in f.readlines():
            (lhs, rhs_str) = [s.strip() for s in line.split('->')]
            # there can be multiple rhs of a rule because of the 'or' symbol
            self.rules[lhs.strip()] = self.parse_rhs_or_clauses(rhs_str)

    def to_serializable(self):
        ser = dict()
        for lhs in self.rules.keys():
            ser[lhs] = []
            for rhs in self.rules[lhs]:
                ser[lhs].append([sym.val for sym in rhs])
        return ser

    @staticmethod
    def from_dict(grammar_dict):
        nonterminals = grammar_dict.keys()
        cfg = CFG()
        for nonterminal in nonterminals:
            rules = grammar_dict[nonterminal]
            cfg.rules[nonterminal.strip()] = rules
        return cfg


if __name__ == '__main__':
    cfg = CFG()
    cfg.load('resources/simplegrammar.cfg')
    num_sentences = 20
    fh = open('./cfg_generated_sentences.txt', 'w')
    gen = cfg.generate()
    print(gen)
    str = '. '.join([' '.join(cfg.generate()) for _ in range(10)]) + "."
    fh.write(str)
    fh.close()
    print('write %d random sentences' % num_sentences)
