from cfg import CFG
import json
import sys
import re, string
from collections import defaultdict


VERBOSE = True

class Node(object):

    def __init__(self):
        self._next = None
        self._symbol = None

    def set_next(self, nextval):
        self._next = nextval

    def get_next(self):
        return self._next

    def get_symbol(self):
        return self._symbol

    def bind(self, symbol):
        self._symbol = symbol

    def has_next(self):
        return self._next is not None

    def is_bound(self):
        return self._symbol is not None


class VarNode(Node):

    WILDCARD = '*'

    def __init__(self, var):
        super().__init__()
        self._is_start_node = False
        self._is_final_node = False
        self._var = var

    def __str__(self):
        if self._symbol is not None:
            sym = " (%s)" % str(self._symbol)
        else:
            sym = ""
        return "%s%s" % (self._var, sym)

    def matches(self, val):
        return val == self._symbol or self._symbol == VarNode.WILDCARD

    def set_is_start_node(self):
        self._is_start_node = True

    def set_is_final_node(self):
        self._is_final_node = True

    def is_final(self):
        return self._is_final_node

    def is_start(self):
        return self._is_start_node

    def get_var(self):
        return self._var

    def reset(self):
        self._symbol = None

    def clone_and_bind_symbol(self, symbol):
        new_node = VarNode(self.get_var())
        new_node._is_final_node = self._is_final_node
        new_node._is_start_node = self._is_start_node
        new_node.set_next(self.get_next())
        new_node.bind_symbol(symbol)
        return new_node


class PatternTemplateDef(object):

    """
    A simple definition 'language' for pattern machines.

    Simply consists of a connection symbol that connects symbols. The direction is from the symbol on the left
    to the symbol to the right of the connection. A connection that has only a node on the left and none on the right
    is interpreted to be an outgoing connection (a 'receiver' node) and one with only a symbol on the right and none
    on the left is an 'incoming'/'acceptor' node.

    Conections are delimited by the special separator symbol.

    Spaces are ignored but recommended between connections. Symbols can be anything that isn't the connection symbol,
    the separator symbol or the 'wildcard' symbol.

    This def will probably change as we accept higher level grammars than just those that can be accepted by a DFA.
    At least that is the hope.
    """

    CONNECTION = '-'
    SEPARATOR = ';'
    WILDCARD = VarNode.WILDCARD

    def __init__(self):
        pass

    @staticmethod
    def clean(pattern_string):
        cl = re.sub(r"\s*", "", pattern_string)
        cl = re.sub("\n", "", cl)
        return cl

    @staticmethod
    def is_start(con):
        return list(con)[0] == PatternTemplateDef.CONNECTION

    @staticmethod
    def is_final(con):
        return list(con)[-1] == PatternTemplateDef.CONNECTION

    @staticmethod
    def check(pattern_string):
        has_start_node = bool(re.search(r"(^-)|(;-)", pattern_string))
        has_end_node = bool(re.search(r"(-$)|(-;)", pattern_string))
        return has_end_node and has_start_node


class Status:

    Consuming = "consuming"
    FoundMatch = "found_match"
    NoMatch = "no_match"
    Idle = "idle"


# for now, this is just a DFA...
class PatternTemplate:
    """
    Class that builds a pattern template architecture -- but not assigning matching symbols.
    It is the Pattern class that binds match symbols for the architecture created by a
    pattern template.
    """

    str_idx = -1
    num_chars = 1

    def __init__(self, pattern_def_string: str, is_available=False) -> object:
        self.all_nodes = dict()
        self.start_key = None
        self.pattern_def_string = pattern_def_string
        self.parse(pattern_def_string)
        self.curr_node = self.all_nodes[self.start_key]
        self.status = Status.Idle
        self.matchseq = []  # store the sequenec that is being matched
        self.uid = PatternTemplate.get_uid()
        self._is_available = is_available

    def __str__(self):
        s = self.pattern_def_string
        return "(%s) %s" % (self.uid, s)

    @staticmethod
    def get_uid():
        if PatternTemplate.str_idx >= len(string.ascii_uppercase):
            PatternTemplate.str_idx = 0
            PatternTemplate.num_chars += 1
        uid = string.ascii_uppercase[PatternTemplate.str_idx + 1]
        PatternTemplate.str_idx += 1
        return uid

    def set_is_available(self, is_available):
        self._is_available = is_available

    def is_available(self):
        return self._is_available

    def parse(self, pattern_string):
        if not PatternTemplateDef.check(pattern_string):
            raise Exception("Pattern definition does not check out.")
        connections = PatternTemplateDef.clean(pattern_string).split(PatternTemplateDef.SEPARATOR)
        for con in connections:
            con = PatternTemplateDef.clean(con)
            con_spl = list(filter(lambda x: len(x) > 0, con.split(PatternTemplateDef.CONNECTION)))
            if len(con_spl) > 2:
                raise Exception("Too many connection elements in pattern definition.")
            if PatternTemplateDef.is_start(con):
                start_var = con_spl[0]
                self.add_start_var(start_var)
            elif PatternTemplateDef.is_final(con):
                self.add_final_var(con_spl[0])
            else:
                self.add_connection(con_spl[0], con_spl[1])

    def get_status(self):
        return self.status

    def get_varnode(self, var) -> VarNode:
        if var not in self.all_nodes.keys():
            self.all_nodes[var] = VarNode(var)
        return self.all_nodes[var]

    def add_connection(self, var_fr, var_to):
        node_fr = self.get_varnode(var_fr)
        node_to = self.get_varnode(var_to)
        node_fr.set_next(node_to)

    def add_start_var(self, var):
        node = self.get_varnode(var)
        node.set_is_start_node()
        self.start_key = var

    def add_final_var(self, var):
        node = self.get_varnode(var)
        node.set_is_final_node()

    def get_transition_nodes(self):
        nodes = [self.all_nodes[key] for key in self.all_nodes.keys()
                 if not (self.all_nodes[key].is_final() or self.all_nodes[key].is_accept())]
        return nodes

    def consume_next(self, sym):
        self.matchseq.append(sym)
        if self.curr_node.is_bound():
            if self.curr_node.matches(sym) and self.curr_node.is_final():
                self.status = Status.FoundMatch
            elif self.curr_node.matches(sym):
                self.status = Status.Consuming
            else:
                self.status = Status.NoMatch
        else:
            self.curr_node.bind(sym)
            if self.curr_node.is_final():
                self.status = Status.FoundMatch
            else:
                self.status = Status.Consuming
        # advance to next node
        self.curr_node = self.curr_node.get_next()
        return self.status

    def get_start_varnode(self):
        return self.all_nodes[self.start_key]

    def reset(self):
        for k in self.all_nodes.keys():
            self.all_nodes[k].reset()
        self.matchseq = []
        self.status = Status.Idle
        self.curr_node = self.get_start_varnode()

    def get_match_sequence(self):
        return self.matchseq


class MatchRecord:

    def __init__(self, match_sequence, lhs, rhs_position):
        self.match_sequence = match_sequence
        self.lhs = lhs
        self.rhs_position = rhs_position
        self.match_count = 1

    def increment_count(self):
        self.match_count += 1

    @staticmethod
    def get_hash(seq):
        return '.'.join([str(s) for s in seq])


class MetaGrammar:

    def __init__(self, pattern_strings):
        self.grammar = CFG()
        self.running_pattern_templates = defaultdict(list)
        self.available_pattern_templates = defaultdict(list)
        self.match_records = dict()
        self.pattern_strings = pattern_strings
        for ps in pattern_strings:
            # initialize a first pattern template for each of the types of pattern templates
            # more will be created as needed to track patterns as the sequence is traversed
            self.available_pattern_templates[ps].append(PatternTemplate(ps))

    def initialize(self, text):
        self.grammar.load_from_text(text)

    def add_match_record(self, seq, lhs, curr_pos):
        # we'll only add the match sequence with relevant information here. leave it to another method for
        # how to replace the found sequences (since there will necessarily be conflicts and ordering considerations)
        match_key = MatchRecord.get_hash(seq)
        if match_key in self.match_records.keys():
            self.match_records[match_key].increment_count()
        else:
            rhs_pos = curr_pos - len(seq) + 1
            self.match_records[match_key] = MatchRecord(seq, lhs, rhs_pos)

    def ensure_running_pattern_templates_exist(self, pattern_string):
        # either use an existing and available pattern template or create a new one if necessary
        if len(self.available_pattern_templates[pattern_string]) == 0:
            # there aren't any already available so create a new one
            self.running_pattern_templates[pattern_string].append(PatternTemplate(pattern_string, is_available=False))
        else:
            # reuse a pattern template for the new subsequence starting at curr_pos
            pt = self.available_pattern_templates[pattern_string].pop()
            pt.set_is_available(False)
            self.running_pattern_templates[pattern_string].append(pt)

    def consume_sequence(self, seq, lhs):
        for curr_pos in range(len(seq)):
            symbol = seq[curr_pos]
            for ps in self.pattern_strings:
                self.ensure_running_pattern_templates_exist(ps)
                for pt in self.running_pattern_templates[ps]:
                    status = pt.consume_next(symbol)
                    if status == Status.NoMatch:
                        self.flag_pattern_template_for_reuse(pt)
                        self.reset_patterntemplate_and_make_available(pt, ps)
                    elif status == Status.FoundMatch:
                        match_sequence = pt.get_match_sequence()
                        self.add_match_record(match_sequence, lhs, curr_pos)
                        if VERBOSE:
                            print("found sequence: %s" % ' '.join(match_sequence))
                        self.flag_pattern_template_for_reuse(pt)
                for pt in self.running_pattern_templates[ps]:
                    if pt.is_available():
                        self.reset_patterntemplate_and_make_available(pt, ps)

    @staticmethod
    def flag_pattern_template_for_reuse(pattern_template):
        pattern_template.set_is_available(True)

    def reset_patterntemplate_and_make_available(self, pattern_template, pattern_string):
        pattern_template.reset()
        self.running_pattern_templates[pattern_string].remove(pattern_template)
        self.available_pattern_templates[pattern_string].append(pattern_template)

    def run_patterns(self):
        # TODO
        for i in range(3):
            print("\n - pattern run %d" % (i+1))
            #self.grammar = PatternFinder.seqs_of_seqs(self.grammar, self.window_length, self.stride)
            #self.grammar = PatternFinder.follows(self.grammar)
            #self.grammar = PatternFinder.precedes(self.grammar)
            #self.grammar.clean_up()

    def print_grammar(self):
        print(str(self.grammar))

    def save_grammar(self, filename="metag.json"):
        fh = open(filename, 'w')
        fh.write(json.dumps(self.grammar.to_serializable(), indent=4, sort_keys=True))
        fh.close()


def simple_text():
    return 'john hit the pedestrian. mary hit a tree!'


def a_few_sentences():
    return 'my undervalued monkey above my leaf ate through another exploding man. another worm under our exciting pajamas interjected through another elephant. my chair sat a girl.'


def cfg_text():
    cfg = CFG()
    cfg.load('simplegrammar.cfg')
    num_sentences = 40
    sents = [' '.join(cfg.generate()) for _ in range(num_sentences)]
    return '.'.join(sents)


def nmw_seq():
    return list('abcdbc')


def runner(text):
    mg = MetaGrammar('x-y')
    mg.initialize(text)
    print("\n--- INITIAL")
    mg.print_grammar()
    print("\n--- PATTERNS...")
    mg.run_patterns()
    print("\n--- FINAL")
    mg.print_grammar()
    #exp_str = mg.grammar.get_expanded_string()
    #print ("EXPANDED STRING: \n %s" % exp_str)
    print("\n--- RANDOM SENTENCES")
    NUM_SENTS = 20
    for i in range(NUM_SENTS):
        exp_rand = mg.grammar.generate()
        print("* %s\n" % exp_rand)
    mg.save_grammar('simplegrammar.json')


if __name__ == '__main__':

    pt = PatternTemplate('-x;x-y;y-')

    sys.argv[1] = '1'
    if sys.argv[1] == '1':
        text = simple_text()
    elif sys.argv[1] == '2':
        text = a_few_sentences()
    elif sys.argv[1] == '4':
        text = nmw_seq()
    else:
        text = cfg_text()
    runner(text)
