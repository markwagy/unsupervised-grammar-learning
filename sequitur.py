import typing
import string


class Node:

    def __init__(self, data, prevnode=None, nextnode=None, is_terminal=False):
        self._data = data
        self._next = nextnode
        self._prev = prevnode
        self._is_terminal = is_terminal
        self._rule_ptr = None

    def __str__(self):
        return "[%s]" % self._data

    @staticmethod
    def get_symlink(node):
        new_node = Node(node.get_data(), is_terminal=False)
        new_node._rule_ptr = node
        return new_node

    def get_next(self):
        return self._next

    def get_rule_ptr(self):
        return self._rule_ptr

    def set_rule_ptr(self, rule_node):
        self._rule_ptr = rule_node

    def get_prev(self):
        return self._prev

    def get_data(self):
        return self._data

    def set_next(self, nodeval):
        self._next = nodeval

    def set_prev(self, nodeval):
        self._prev = nodeval

    def is_terminal(self):
        return self._is_terminal


class IndexInfo:

    def __init__(self, ref_node, count=0):
        self.count = count
        self.ref_node = ref_node


class Sequitur:

    GUARD_SYMBOL = '[]'
    START_SYMBOL = 'S'

    str_idx = -1
    num_chars = 1

    @staticmethod
    def get_uid():
        if Sequitur.str_idx >= len(string.ascii_uppercase):
            Sequitur.str_idx = 0
            Sequitur.num_chars += 1
        uid = string.ascii_uppercase[Sequitur.str_idx + 1]
        Sequitur.str_idx += 1
        return uid

    def __init__(self):
        self.digram_index = dict()
        # start off rule structure with the start rule
        self.start_rule = Sequitur.construct_start_rule()

    @staticmethod
    def construct_start_rule():
        rule_node = Node(Sequitur.START_SYMBOL, is_terminal=False)
        guard_node = Sequitur.get_guard_node(rule_node=rule_node)
        rule_node.set_next(guard_node)
        return rule_node

    def __str__(self):
        return "Sequitur"

    def print_grammar_string(self):
        rules = Sequitur.get_rules(self.start_rule)
        s = '\n'.join([Sequitur.rule_string(r) for r in rules])
        print(s)

    @staticmethod
    def rule_string(rule_head_node: Node) -> str:
        s = rule_head_node.get_data()
        s += " -> "
        # skip gaurd node
        next_node = Sequitur.get_rule_rhs(rule_head_node)
        while not Sequitur.is_guard_node(next_node):
            s += "%s " % next_node.get_data()
            next_node = next_node.get_next()
        return s

    @staticmethod
    def get_rule_rhs(lhs_node):
        return lhs_node.get_next().get_next()

    @staticmethod
    def get_rules(start_rule_node):
        rules_todo_list = [start_rule_node]
        rules_done_list = []
        while len(rules_todo_list) > 0:
            rule = rules_todo_list[0]
            rules_done_list.append(rule)
            node = Sequitur.get_rule_rhs(rule)
            if node is None:
                continue
            while not Sequitur.is_guard_node(node):
                rule_ptr = node.get_rule_ptr()
                if rule_ptr is not None and rule_ptr.get_data() not in [n.get_data() for n in rules_todo_list]:
                    rules_todo_list.append(node.get_rule_ptr())
                node = node.get_next()
            rules_todo_list = rules_todo_list[1:]
        return list(set(rules_done_list))

    @staticmethod
    def dedupe_rule_list(rules):
        seen = []
        lst = []
        for obj in rules:
            if obj.get_data() not in seen:
                lst.append(obj)
                seen.append(obj.get_data())
        return lst

    @staticmethod
    def get_digram_key(digram: list) -> string:
        return '.'.join([d.get_data() for d in digram])

    def digram_contains_guard(self, digram: list) -> bool:
        return any([Sequitur.is_guard_node(n) for n in digram])

    def add_digram_to_index(self, digram, ref_node_idx=0):
        if self.digram_contains_guard(digram):
            return
        digram_key = self.get_digram_key(digram)
        ref_node = digram[ref_node_idx]
        self.digram_index[digram_key] = IndexInfo(ref_node)

    @staticmethod
    def get_guard_node(rule_node: Node, next_node=None) -> Node:
        return Node(Sequitur.GUARD_SYMBOL, prevnode=rule_node, nextnode=next_node, is_terminal=False)

    def construct_rule_head(self) -> Node:
        rule_id = Sequitur.get_uid()
        rule_node = Node(rule_id, is_terminal=False)
        guard_node = self.get_guard_node(rule_node)
        rule_node.set_next(guard_node)
        return rule_node

    @staticmethod
    def is_guard_node(node):
        return node.get_data() == Sequitur.GUARD_SYMBOL

    @staticmethod
    def get_rule_end_node(rule_start_node):
        # first node is the one past the guard node
        guard_node = rule_start_node.get_next()
        next_node = guard_node
        while not Sequitur.is_guard_node(next_node.get_next()):
            next_node = next_node.get_next()
        return next_node

    def remove_from_index(self, digram):
        if not Sequitur.is_guard_node(digram[1]):
            digram_key = self.get_digram_key(digram)
            self.digram_index.pop(digram_key, None)

    def update_index(self, digram, ref_node):
        if self.digram_contains_guard(digram):
            return
        self.digram_index[self.get_digram_key(digram)].ref_node = ref_node

    def make_link(self, prev_node, next_node):
        prev_node.set_next(next_node)
        # a guard node should maintain the rule head node as its previous node
        if not Sequitur.is_guard_node(next_node):
            next_node.set_prev(prev_node)

    def splice_new_rule(self, digram: list) -> Node:
        # maintain previous instance of this bigram so we can splice the new rule in later
        prev_matching_digram_refnode = self.digram_index[self.get_digram_key(digram)].ref_node
        prev_matching_digram = [prev_matching_digram_refnode, prev_matching_digram_refnode.get_next()]
        # create new rule and splice in
        rule_node = self.construct_rule_head()  # create new rule without rhs yet
        guard_node = rule_node.get_next()  # get new rule's guard node
        tmp_next_node = digram[1].get_next()  # save next node in the original rule
        tmp_prev_node = digram[0].get_prev()  # save prev node in the original  rule
        self.make_link(guard_node, digram[0])  # attach new rule's guard node to left digram
        self.remove_from_index([tmp_prev_node, digram[0]])  # break old link in index hash
        self.make_link(digram[1], guard_node)  # wrap right digram around to new rule's guard node
        self.remove_from_index([digram[1], tmp_next_node])  # break old link in index table
        rule_node_symlink = Node.get_symlink(rule_node)  # 'symlink' rule for the digram's place in the old rule
        self.make_link(tmp_prev_node, rule_node_symlink)  # attach symlink's back pointer to previous node in old rule
        self.add_digram_to_index([rule_node_symlink, tmp_prev_node])  # add new digram to index
        self.make_link(rule_node_symlink, tmp_next_node)  # attach symlink's next point to next node in old rule
        self.add_digram_to_index([rule_node_symlink, tmp_next_node])  # add new digram to index
        self.update_index(digram, digram[0])
        # now update the previous matching digram with the newly created rule
        self.splice_existing_rule(rule_node, prev_matching_digram)

    def get_digram_reference_node(self, digram_key):
        return self.digram_index[digram_key].ref_node

    def get_rule(self, digram):
        digram_key = self.get_digram_key(digram)
        ref_node = self.get_digram_reference_node(digram_key)
        return ref_node.get_prev().get_prev()

    @staticmethod
    def get_rule_rhs_data(rule_node):
        curr = Sequitur.get_rule_rhs(rule_node)
        vals = []
        while not Sequitur.is_guard_node(curr.get_next()):
            vals.append(curr.get_data())
            curr = curr.get_next()
        return vals

    @staticmethod
    def rule_matches_digram(rule_ref_node, digram_ref_node):
        # in order for a rule to match a digram, the rule must start with the first element, end with the last and
        # have nothing in between. also make sure it is a rule
        digram_data = [digram_ref_node.get_data(), digram_ref_node.get_next().get_data()]
        rule_data = Sequitur.get_rule_rhs_data(rule_ref_node)
        if len(digram_data) != len(rule_data):
            return False
        return all([digram_data[i] == rule_data[i] for i in len(digram_data)])

    def rule_exists_for_digram(self, digram):
        ref_node = self.get_rule(digram)
        #return ref_node.get_prev().get_data() == Sequitur.GUARD_SYMBOL
        return Sequitur.rule_matches_digram(rule_ref_node=ref_node, digram_ref_node=digram[0])

    def digram_exists(self, digram):
        return self.get_digram_key(digram) in self.digram_index.keys()

    def start_rule_empty(self):
        return self.start_rule.get_next().get_next() is None

    def append_to_start_rule(self, new_node):
        if self.start_rule_empty():
            guard_node = self.start_rule.get_next()
            guard_node.set_next(new_node)
            new_node.set_prev(guard_node)
            new_node.set_next(guard_node)
        else:
            end_node = Sequitur.get_rule_end_node(self.start_rule)
            guard_node = end_node.get_next()
            end_node.set_next(new_node)
            new_node.set_prev(end_node)
            new_node.set_next(guard_node)

    def splice_existing_rule(self, rule_node, digram):
        rule_node_symlink = Node.get_symlink(rule_node)
        prev_node = digram[0].get_prev()  # save prev node in the original  rule
        next_node = digram[1].get_next()  # save next node in the original rule
        self.make_link(prev_node, rule_node_symlink)
        self.make_link(rule_node_symlink, next_node)
        self.remove_from_index([prev_node, digram[0]])  # break old link in index hash
        self.remove_from_index([digram[1], next_node])  # break old link in index table

    def consume_sequence(self, seq_vals):
        left_node = Node(seq_vals[0], is_terminal=True)
        self.append_to_start_rule(left_node)
        for i in range(1, len(seq_vals)):
            right_node = Node(seq_vals[i], is_terminal=True)
            self.append_to_start_rule(right_node)
            digram = [left_node, right_node]
            if not self.digram_exists(digram):
                # add digram to index, but do nothing else because we've already added the digram to the 'start rule'
                self.add_digram_to_index(digram, ref_node_idx=0)
            else:
                # splice in rule
                if self.rule_exists_for_digram(digram):
                    rule_node = self.get_rule(digram)
                    self.splice_existing_rule(rule_node, digram)
                else:
                    self.splice_new_rule(digram)
            left_node = right_node

    @staticmethod
    def run(seq):
        s = Sequitur()
        s.consume_sequence(seq)
        print("\nGrammar: \n%s" % s.print_grammar_string())


if __name__ == '__main__':
    #seq = list('abcdbc')
    seq = list('bcbcbc')
    Sequitur.run(seq)

