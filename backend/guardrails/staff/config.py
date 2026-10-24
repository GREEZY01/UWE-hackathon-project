from nemoguardrails.embeddings.index import EmbeddingsIndex


class LexicalIndex(EmbeddingsIndex):
    """Local token-overlap index; not a semantic embedding model."""
    def __init__(self, **kwargs):
        self.items = []

    async def add_item(self, item):
        self.items.append(item)

    async def add_items(self, items):
        self.items.extend(items)

    async def search(self, text, max_results=5, threshold=None):
        tokens = set(text.lower().split())
        def score(item):
            other = set(item.text.lower().split())
            return len(tokens & other) / max(1, len(tokens | other))
        return [i for i in sorted(self.items, key=score, reverse=True)
                if score(i) >= (threshold or 0)][:max_results]


def init(app):
    app.register_embedding_search_provider('lexical', LexicalIndex)
