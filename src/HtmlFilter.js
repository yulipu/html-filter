/**
 * HtmlFilter
 */
'use strict';

module.exports = HtmlFilter;

function HtmlFilter() {
    
    // <(xxx)( data-name="lisi") xxx />
    // </(xxx)>
    // <!--(xxx)-->
    // 此正则有四个子模式
    // 1. 代表开始标签名称
    // 2. 代表整个属性部分
    // 3. 代表结束标签名称
    // 4. 代表注释内容
    this.htmlPartsRegex = /<(?:(?:(\w+)((?:\s+[\w\-:]+(?:\s*=\s*(?:(?:"[^"]*")|(?:'[^']*')|[^>\s]+))?)*)[\S\s]*?\/?>)|(?:\/([^>]+)>)|(?:!--([\S|\s]*?)-->))/g;

    // (title)="()"
    this.attributesRegex = /([\w\-:]+)\s*=\s*(?:(?:"([^"]*)")|(?:'([^']*)')|([^>\s]+))/g;
    
    /**
     * Legal tags
     *
     * {
     *     p: null,
     *     img: {src: 1, width: 1, height: 1},
     *     ...
     * }
     */
    this.allowedTags = null;
    
    /**
     * result string
     */
    this.htmlString = '';
    
    /**
     * trace stack
     */
    this.illegalStack = null;
    
}
HtmlFilter.prototype = {
    constructor: HtmlFilter,
    reset: function() {
        this.htmlString = '';
        
        this.illegalStack = new XStack();
    },
    
    /**
     * Determine whether a tag is a selfClosingTag
     *
     * @param {String} nodeName
     * @return Boolean
     */
    isSelfClosingTag: function(nodeName) {
        return 1 === HtmlFilter.selfClosingTags[nodeName];
    },
    
    /**
     * Determine whether a attribute is empty
     *
     * @param {String} attribute
     * @return Boolean
     */
    isEmptyAttribute: function(attribute) {
        return 1 === HtmlFilter.emptyAttributes[attribute];
    },
    
    /**
     * Get the support attributes of a tag
     *
     * @param {String} nodeName
     * @return null | Object
     */
    getAllowedAttributes: function(nodeName) {
        // tag not in white list or tag not support attributes
        if(undefined === this.allowedTags[nodeName] || null === this.allowedTags[nodeName]) {
            return null;
        }
        
        return this.allowedTags[nodeName];
    },
    
    /**
     * Determine whether the tag is legitimate
     *
     * @param {String} nodeName
     * @return Boolean
     */
    isAllowedTag: function(nodeName) {
        if(null === this.allowedTags) {
            return true;
        }
        
        // white list
        // null is exists yet
        if(undefined !== this.allowedTags[nodeName]) {
            return true;
        }
        
        return false;
    },
    
    onOpen: function(tagName, attributes) {
        var nodeName = tagName.toLowerCase();
        var attrs = attributes;
        var nodeString = '';
        
        // tag filter
        if(!this.isAllowedTag(nodeName)) {
            // not selfClosingTag
            if(!this.isSelfClosingTag(nodeName)) {
                // set illegal flag
                this.illegalStack.push(nodeName);
            }
            
            return;
        }
        
        // support bug it's parent is illegal
        if(this.illegalStack.size > 0) {
            if(!this.isSelfClosingTag(nodeName)) {
                // set illegal flag
                this.illegalStack.push(nodeName);
            }
            
            return;
        }
        
        // attributes filter
        var allowedAttributes = this.getAllowedAttributes(nodeName);
        if(null !== allowedAttributes) {
            for(var k in attrs) {
                if(undefined === allowedAttributes[k]) {
                    delete attrs[k];
                }
            }
        }

        nodeString = '<' + nodeName;
        
        // null means not support attributes
        if(null !== allowedAttributes) {
            for(var k in attrs) {
                nodeString += (' ' + k + '="' + attrs[k] + '"');
            }
        }
        
        // selfClosingTag
        if(this.isSelfClosingTag(nodeName)) {
            nodeString += ' /';
        }
        
        nodeString += '>';
        
        this.htmlString += nodeString;
    },
    
    onClose: function(tagName) {
        if(this.illegalStack.size > 0) {
            this.illegalStack.pop();
            
            return;
        }
        
        var nodeName = tagName.toLowerCase();
        var nodeString = '</' + nodeName + '>';
        
        this.htmlString += nodeString;
    },
    
    onComment: function(content) {
        this.onText(content);
    },
    
    onText: function(text) {
        if(this.illegalStack.size > 0) {
            return;
        }
        
        this.htmlString += text;
    },
    
    /**
     * filter html
     *
     * @param {String} html
     */
    filter: function(html) {
        var parts = null;
        // the index at which to start the next match
        var lastIndex = 0;
        var tagName = '';
        
        // reset first
        this.reset();

        while( null !== (parts = this.htmlPartsRegex.exec(html)) ) {
            // TextNode
            if(parts.index > lastIndex) {
                var text = html.substring( lastIndex, parts.index );

                this.onText(text);
            }
            lastIndex = this.htmlPartsRegex.lastIndex;

            // closing tag
            if( (tagName = parts[3]) ) {
                this.onClose(tagName);

                continue;
            }

            // opening tag & selfClosingTag
            if( (tagName = parts[1]) ) {

                var attrParts = null;
                var attrs = {};

                // attributes
                if(parts[2]) {
                    while ( null !== ( attrParts = this.attributesRegex.exec(parts[2]) ) ) {
                        var attrName = attrParts[1];
                        var attrValue = attrParts[2] || attrParts[3] || attrParts[4] || '';

                        if(this.isEmptyAttribute(attrName)) {
                            attrs[attrName] = attrName;

                            continue;
                        }

                        attrs[attrName] = attrValue;
                    }
                }

                this.onOpen(tagName, attrs);

                continue;
            }

            // comment
            if( (tagName = parts[4]) ) {
                this.onComment(tagName);
            }
        }

        return this;
    },
    
    /**
     * get html
     */
    getHtml: function() {        
        return this.htmlString;
    }
};

/**
 * selfClosingTag
 */
HtmlFilter.selfClosingTags = {
    meta: 1,
    base: 1,
    link: 1,
    hr: 1,
    br: 1,
    wbr: 1,
    col: 1,
    img: 1,
    area: 1,
    input: 1,
    textarea: 1,
    embed: 1,
    param: 1,
    source: 1,
    object: 1
};

/**
 * 可以为空的属性
 */
HtmlFilter.emptyAttributes = {
    checked: 1,
    compact: 1,
    declare: 1,
    defer: 1,
    disabled: 1,
    ismap: 1,
    multiple: 1,
    nohref: 1,
    noresize: 1,
    noshade: 1,
    nowrap: 1,
    readonly: 1,
    selected: 1
};

/**
 * Stack
 */
function XStack() {
    this.headNode = null;
    this.tailNode = null;
    this.size = 0;
}
XStack.prototype = {
    constructor: XStack,

    push: function(data) {
        var node = new XStackNode(data, null, null);

        if(0 === this.size) {
            this.headNode = node;

        } else {
            this.tailNode.next = node;
            node.prev = this.tailNode;
        }

        this.tailNode = node;

        this.size++;
    },

    pop: function() {
        var ret = this.tailNode.data;

        if(0 === this.size) {
            return null;
        }
        if(1 === this.size) {
            this.headNode = this.tailNode = null;
            this.size--;

            return ret;
        }

        this.tailNode = this.tailNode.prev;
        this.tailNode.next.prev = null;
        this.tailNode.next = null;
        this.size--;

        return ret;
    },

    getHead: function() {
        return null === this.headNode ? null : this.headNode.data;
    },
    
    getTail: function() {
        return null === this.tailNode ? null : this.tailNode.data;
    },

    clear: function() {
        while(0 !== this.size) {
            this.pop();
        }
    },

    toString: function() {
        var str = '[ ';

        for(var current = this.headNode; null !== current; current = current.next) {
            str += current.data + ' ';
        }

        return str + ' ]';
    }
};

/**
 * Node
 */
function XStackNode(data, prev, next) {
    this.data = data;
    this.prev = prev;
    this.next = next;
}
