/**
 * page-exporter —— 导出当前页面的完整结构数据（供 MCP/AI 批量消费）
 *
 * 导出内容：
 * 1. 页面所有顶层画板/图层清单（id = layer_id，可直接拿去调 MCP design-sections）
 * 2. 每个画板内全部文字内容（需求说明、批注、UI 文案）
 * 3. 每个节点的原型交互 reactions（跳转逻辑：ON_CLICK → NAVIGATE/OVERLAY → destinationId）
 *
 * 主线程（沙箱）负责读文档，UI 线程负责展示和下载。
 */

mg.showUI(__html__, { width: 440, height: 580 });

/** 序列化节点上的原型交互（reactions 是实验性 API，做防御） */
function serializeReactions(node) {
    try {
        const reactions = node.reactions;
        if (!reactions || !reactions.length) return undefined;
        return reactions.map((r) => ({
            trigger: r.trigger ? { type: r.trigger.type, delay: r.trigger.delay } : undefined,
            action: r.action
                ? {
                      type: r.action.type,
                      destinationId: r.action.destinationId,
                      navigation: r.action.navigation,
                      url: r.action.url,
                      transition: r.action.transition
                          ? {
                                type: r.action.transition.type,
                                duration: r.action.transition.duration,
                                direction: r.action.transition.direction,
                            }
                          : undefined,
                  }
                : undefined,
        }));
    } catch (e) {
        return undefined;
    }
}

/** 递归收集：文字节点内容 + 带交互的节点（跳转可能挂在画板内的按钮上） */
function walk(node, texts, interactive, path) {
    const currentPath = path ? `${path} / ${node.name}` : node.name;
    if (node.type === 'TEXT') {
        const characters = node.characters || '';
        if (characters.trim()) {
            texts.push({ id: node.id, name: node.name, characters, path: currentPath });
        }
    }
    const reactions = serializeReactions(node);
    if (reactions) {
        interactive.push({ id: node.id, name: node.name, type: node.type, path: currentPath, reactions });
    }
    const children = node.children;
    if (children && children.length) {
        for (const child of children) walk(child, texts, interactive, currentPath);
    }
}

function exportPage() {
    const page = mg.currentPage;
    const frames = [];
    for (const node of page.children) {
        const texts = [];
        const interactive = [];
        // 顶层节点自身的交互也要收（画板级跳转很常见），walk 已覆盖
        walk(node, texts, interactive, '');
        frames.push({
            id: node.id, // 即 MCP 用的 layerId
            name: node.name,
            type: node.type,
            x: Math.round(node.x),
            y: Math.round(node.y),
            width: Math.round(node.width),
            height: Math.round(node.height),
            textCount: texts.length,
            texts,
            interactiveNodes: interactive,
        });
    }
    // 按画布位置排序（先上后下、先左后右），方便对照设计稿
    frames.sort((a, b) => (a.y - b.y) || (a.x - b.x));
    return {
        file: { name: mg.root.name },
        page: { id: page.id, name: page.name },
        exportedAt: new Date().toISOString(),
        frameCount: frames.length,
        frames,
    };
}

mg.ui.onmessage = (msg) => {
    if (msg && msg.type === 'export') {
        try {
            const data = exportPage();
            mg.ui.postMessage({ type: 'export-result', ok: true, data });
        } catch (e) {
            mg.ui.postMessage({ type: 'export-result', ok: false, error: String((e && e.stack) || e) });
        }
    }
    if (msg && msg.type === 'close') {
        mg.closePlugin();
    }
};
