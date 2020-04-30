const createTextElement = (text) => ({
  type: 'TEXT_ELEMENT',
  props: {
    nodeValue: text,
    children: [],
  },
})

const createDom = (fiber) => {
  const dom =
    fiber.type === 'TEXT_ELEMENT'
      ? document.createTextNode('')
      : document.createElement(fiber.type)

  const isProperty = (key) => key !== 'children'
  Object.keys(fiber.props)
    .filter(isProperty)
    .forEach((name) => (dom[name] = fiber.props[name]))

  return dom
}

const reconcileChildren = (wipFiber, elements) => {
  let index = 0
  let oldFiber = wipFiber.alternate && wipFiber.alternate.child
  let prevSibling = null

  while (index < elements.length || oldFiber !== null) {
    const element = elements[index]
    let newFiber = null

    const sameType = oldFiber && element && oldFiber.type == element.type

    if (sameType) {
      newFiber = {
        type: oldFiber.type,
        props: element.props,
        dom: oldFiber.dom,
        parent: wipFiber,
        alternate: oldFiber,
        effectTag: 'UPDATE',
      }
    }

    if (element && !sameType) {
      newFiber = {
        type: element.type,
        props: element.props,
        dom: null,
        parent: wipFiber,
        alternate: null,
        effectTag: 'PLACEMENT',
      }
    }

    if (oldFiber && !sameType) {
      oldFiber.effectTag = 'DELETION'
      deletions.push(oldFiber)
    }

    if (oldFiber) {
      oldFiber = oldFiber.sibling
    }

    if (index === 0) {
      wipFiber.child = newFiber
    } else if (element) {
      prevSibling.sibling = newFiber
    }

    prevSibling = newFiber
    index++
  }
}

const performUnitOfWork = (fiber) => {
  if (!fiber.dom) {
    fiber.dom = createDom(fiber)
  }

  const elements = fiber.props.children
  reconcileChildren(fiber, elements)

  if (fiber.child) {
    return fiber.child
  }

  let nextFiber = fiber
  while (nextFiber) {
    if (nextFiber.sibling) {
      return nextFiber.sibling
    }
    nextFiber = nextFiber.parent
  }
}

const isEvent = (key) => key.startsWith('on')
const isProperty = (key) => key !== 'children' && !isEvent(key)
const isNew = (prev, next) => (key) => prev[key] !== next[key]
const isGone = (prev, next) => (key) => !(key in next)
const updateDom = (dom, prevProps, nextProps) => {
  // Remove old or changed event listeners
  Object.keys(prevProps)
    .filter(isEvent)
    .filter((key) => !(key in nextProps) || isNew(prevProps, nextProps)(key))
    .forEach((name) => {
      const eventType = name.toLowerCase().substring(2)
      dom.removeEventListener(eventType, prevProps[name])
    })

  // Remove old properties
  Object.keys(prevProps)
    .filter(isProperty)
    .filter(isGone(prevProps, nextProps))
    .forEach((name) => {
      dom[name] = nextProps[name]
    })

  // Set new or change properties
  Object.keys(nextProps)
    .filter(isProperty)
    .filter(isNew(prevProps, nextProps))
    .forEach((name) => {
      dom[name] = nextProps[name]
    })

  // Add eventListener
  Object.keys(nextProps)
    .filter(isEvent)
    .filter(isNew(prevProps, nextProps))
    .forEach((name) => {
      const eventType = name.toLowerCase().substring(2)
      dom.addEventListener(eventType, nextProps[name])
    })
}

const commitWork = (fiber) => {
  if (!fiber) {
    return
  }

  const domParent = fiber.parent.dom
  if (fiber.effectTag === 'PLACEMENT' && fiber.dom != null) {
    domParent.appendChild(fiber.dom)
  } else if (fiber.effectTag === 'UPDATE' && fiber.dom !== null) {
    updateDom(fiber.dom, fiber.alternate.props, fiber.props)
  } else if (fiber.effectTag === 'DELETION') {
    domParent.removeChild(fiber.dom)
  }
  domParent.appendChild(fiber.dom)
  commitWork(fiber.child)
  commitWork(fiber.sibling)
}

const commitRoot = () => {
  deletions.forEach(commitWork)
  commitWork(workInProgressRoot.child)
  currentRoot = workInProgressRoot
  workInProgressRoot = null
}

let nextUnitOfWork = null
let workInProgressRoot = null
let currentRoot = null
let deletions = null
const workLoop = (deadline) => {
  let shouldYield = false
  while (nextUnitOfWork && !shouldYield) {
    nextUnitOfWork = performUnitOfWork(nextUnitOfWork)
    shouldYield = deadline.timeRemaining() < 1
  }

  if (!nextUnitOfWork && workInProgressRoot) {
    commitRoot()
  }

  requestIdleCallback(workLoop)
}

requestIdleCallback(workLoop)

class React {
  static createElement(type, props, ...children) {
    return {
      type,
      props: {
        ...props,
        children: children.map((child) =>
          typeof child === 'object' ? child : createTextElement(child)
        ),
      },
    }
  }

  static render(element, container) {
    workInProgressRoot = {
      dom: container,
      props: {
        children: [element],
      },
      alternate: currentRoot,
    }

    deletions = []
    nextUnitOfWork = workInProgressRoot
  }
}

const element = React.createElement(
  'div',
  { id: 'foo' },
  React.createElement('div', null, 'bar'),
  React.createElement('span'),
  'hello'
)

const container = document.getElementById('root')
React.render(element, container)
