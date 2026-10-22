"""Dünner Adapter zum vorhandenen P3-Transport. Kein neuer Deploymentdienst.

status hat einen GET-only HTTP-Adapter UND halt=True. So kann auch ein wartender
P3-Zustand niemals über schritt() einen neuen POST auslösen. Ein persistenter
Exklusivmarker vor POST sperrt jeden weiteren Versuch derselben Absicht.
"""
import importlib.util
import json
from pathlib import Path
import sys


def step(module, mode, repo, intent_path):
    if mode not in ('publish', 'status'):
        raise ValueError('publish oder status erforderlich')
    path = Path(intent_path)
    intent = json.loads(path.read_text())
    reservation = Path(str(path) + '.versand')
    sent = reservation.exists()

    def http(method, *args):
        nonlocal sent
        if method != 'GET':
            if mode != 'publish' or method != 'POST' or sent:
                raise RuntimeError('Status ist POST-unfähig; Absicht bereits versandt')
            # Atomar VOR dem bestehenden Transport, auch bei Crash/429/unklarem Ausgang.
            with reservation.open('x') as out:
                out.write(intent['commit'])
            sent = True
        return module.http_curl(method, *args)

    publisher = module.Veroeffentlichung(
        intent['transportDir'], repo, http=http,
        halt=lambda: mode == 'status' or sent,
    )
    key = str(path.resolve())
    existing = publisher.lesen(key)
    if existing is None:
        if mode == 'status':
            return {'sent': sent, 'state': 'noch nicht angelegt'}
        version = module.commit_version(repo, intent['commit'])
        publisher.anlegen(key, version, intent['commit'])
    publisher.schritt(key)
    result = publisher.beleg(key)
    # Das bestehende Modul erlaubt Nachfahren; dieser Lieferweg bestätigt nur exakt S.
    proof = result.get('beleg') or {}
    exact = (result.get('zustand') == 'live'
             and proof.get('commit') == intent['commit'])
    return {'sent': sent, 'exactLive': exact, 'p3': result}


def main():
    mode, repo, intent_path = sys.argv[1:]
    module_path = Path.home() / 'klarwerk_steuerung/register/ausfuehrung/veroeffentlichung.py'
    spec = importlib.util.spec_from_file_location('klarwerk_existing_p3', module_path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    print(json.dumps(step(module, mode, repo, intent_path), ensure_ascii=False))


if __name__ == '__main__':
    main()
