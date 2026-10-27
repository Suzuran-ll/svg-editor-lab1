import { DOMImplementation, DOMParser, XMLSerializer } from '@xmldom/xmldom';
import type { Document as XmlDocument, Element, Node } from '@xmldom/xmldom';
import type { ReadResult } from '../application/DocumentStore.js';
import { Group } from '../domain/Group.js';
import type { Shape } from '../domain/Shape.js';
import { ShapeFactory } from '../domain/ShapeFactory.js';
import { SvgDocument } from '../domain/SvgDocument.js';

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';
const XMLNS_NAMESPACE = 'http://www.w3.org/2000/xmlns/';
const NUMBER_PATTERN = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i;

/** Converts the supported SVG subset without placing XML concerns in the domain. */
export class SvgCodec {
  decode(source: string): ReadResult {
    // A declaration-looking string inside a comment or CDATA is ordinary content.
    const declarations = source.replace(/<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>/g, '');
    if (/<!DOCTYPE\b/i.test(declarations)) throw new Error('unsupported SVG: DOCTYPE is not allowed');
    let xml: XmlDocument;
    try {
      xml = new DOMParser({
        onError: (_level, message) => { throw new Error(message); },
      }).parseFromString(source, 'application/xml');
    } catch (error) {
      throw new Error(`invalid XML: ${error instanceof Error ? error.message : String(error)}`);
    }

    const root = xml.documentElement;
    if (!root || root.localName !== 'svg') throw new Error('invalid SVG: root element must be svg');
    this.#validateNamespace(root, false);
    for (let node = xml.firstChild; node; node = node.nextSibling) {
      if (node === root || node.nodeType === node.COMMENT_NODE) continue;
      if (node.nodeType === node.PROCESSING_INSTRUCTION_NODE && node.nodeName === 'xml') continue;
      if (node.nodeType === node.TEXT_NODE && !node.nodeValue?.trim()) continue;
      throw new Error('unsupported SVG: content outside root element');
    }
    const rootAttributes = this.#attributes(root);
    for (const name of Object.keys(rootAttributes)) {
      if (!['width', 'height', 'viewBox'].includes(name)) throw new Error(`unsupported SVG root attribute: ${name}`);
    }
    const width = this.#dimension(rootAttributes.width, 800, 'width');
    const height = this.#dimension(rootAttributes.height, 600, 'height');
    if (rootAttributes.viewBox !== undefined) {
      const parts = rootAttributes.viewBox.trim().split(/[\s,]+/);
      const expected = [0, 0, width, height];
      if (parts.length !== 4 || parts.some((part, index) => !NUMBER_PATTERN.test(part) || Number(part) !== expected[index])) {
        throw new Error('unsupported SVG viewBox: expected 0 0 width height');
      }
    }

    // Reserve all explicit IDs first, including IDs that appear after unnamed nodes.
    const usedIds = new Set<string>();
    const scan = (element: Element): void => {
      this.#validateNamespace(element, Boolean(root.namespaceURI));
      const id = element.getAttribute('id');
      if (id) {
        if (usedIds.has(id)) throw new Error(`id already exists: ${id}`);
        usedIds.add(id);
      }
      this.#elements(element).forEach(scan);
    };
    this.#elements(root).forEach(scan);

    const document = new SvgDocument(width, height);
    const warnings: string[] = [];
    const counters = new Map<string, number>();
    const importElement = (element: Element, containerId?: string): void => {
      const type = element.localName ?? element.tagName;
      const attrs = this.#attributes(element);
      let id = attrs.id;
      if (!id) {
        let number = counters.get(type) ?? 1;
        do { id = `${type}${number++}`; } while (usedIds.has(id));
        counters.set(type, number);
        usedIds.add(id);
        attrs.id = id;
        warnings.push(`warning: assigned id ${id} to unnamed <${type}>`);
      }
      const text = this.#text(element);
      const shape = ShapeFactory.fromSvg(type, id, attrs, text);
      const children = this.#elements(element);
      if (!(shape instanceof Group) && children.length > 0) {
        throw new Error(`unsupported SVG: <${type}> cannot contain elements`);
      }
      if (shape.getText() === undefined && text.trim()) {
        throw new Error(`unsupported SVG: text content in <${type}>`);
      }
      document.add(shape, containerId);
      children.forEach(child => importElement(child, shape.id));
    };
    if (this.#text(root).trim()) throw new Error('unsupported SVG: text content in <svg>');
    this.#elements(root).forEach(element => importElement(element));
    return { document, warnings: Object.freeze(warnings) };
  }

  encode(document: SvgDocument): string {
    const xml = new DOMImplementation().createDocument(SVG_NAMESPACE, 'svg', null);
    const root = xml.documentElement!;
    root.setAttributeNS(XMLNS_NAMESPACE, 'xmlns', SVG_NAMESPACE);
    root.setAttribute('width', String(document.width));
    root.setAttribute('height', String(document.height));
    root.setAttribute('viewBox', `0 0 ${document.width} ${document.height}`);
    const append = (shape: Shape, parent: Element): void => {
      const element = xml.createElementNS(SVG_NAMESPACE, shape.tag);
      for (const [name, value] of Object.entries(shape.getAttributes())) element.setAttribute(name, value);
      const content = shape.getText();
      if (content !== undefined) element.appendChild(xml.createTextNode(content));
      shape.getChildren().forEach(child => append(child, element));
      parent.appendChild(element);
    };
    document.getChildren().forEach(shape => append(shape, root));
    // Literal CR is normalized to LF by XML parsers; references preserve it.
    const serialized = new XMLSerializer().serializeToString(xml).replace(/\r/g, '&#13;');
    return `<?xml version="1.0" encoding="UTF-8"?>\n${serialized}\n`;
  }

  #validateNamespace(element: Element, requireSvg: boolean): void {
    if ((element.namespaceURI && element.namespaceURI !== SVG_NAMESPACE) || (requireSvg && element.namespaceURI !== SVG_NAMESPACE)) {
      throw new Error(`unsupported SVG namespace: ${element.namespaceURI ?? '(empty)'}`);
    }
  }

  #attributes(element: Element): Record<string, string> {
    const attrs: Record<string, string> = Object.create(null) as Record<string, string>;
    for (let index = 0; index < element.attributes.length; index++) {
      const attr = element.attributes.item(index)!;
      if (attr.namespaceURI === XMLNS_NAMESPACE) {
        if (attr.value && attr.value !== SVG_NAMESPACE) throw new Error(`unsupported SVG namespace: ${attr.value}`);
        continue;
      }
      if (attr.namespaceURI || attr.name.includes(':')) throw new Error(`unsupported SVG attribute: ${attr.name}`);
      attrs[attr.name] = attr.value;
    }
    return attrs;
  }

  #elements(parent: Node): Element[] {
    const result: Element[] = [];
    for (let child = parent.firstChild; child; child = child.nextSibling) {
      if (child.nodeType === child.ELEMENT_NODE) result.push(child as Element);
      else if (child.nodeType !== child.TEXT_NODE && child.nodeType !== child.CDATA_SECTION_NODE && child.nodeType !== child.COMMENT_NODE) {
        throw new Error(`unsupported SVG node: ${child.nodeName}`);
      }
    }
    return result;
  }

  #text(parent: Node): string {
    let result = '';
    for (let child = parent.firstChild; child; child = child.nextSibling) {
      if (child.nodeType === child.TEXT_NODE || child.nodeType === child.CDATA_SECTION_NODE) result += child.nodeValue ?? '';
    }
    return result;
  }

  #dimension(value: string | undefined, fallback: number, name: string): number {
    if (value === undefined) return fallback;
    const numeric = value.trim().replace(/px$/, '');
    if (!NUMBER_PATTERN.test(numeric) || !Number.isFinite(Number(numeric)) || Number(numeric) <= 0) {
      throw new Error(`invalid SVG ${name}: expected a positive number or px length`);
    }
    return Number(numeric);
  }
}
