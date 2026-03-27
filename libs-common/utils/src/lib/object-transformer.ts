type GetChildrenType<T, R> = (value: T) => R[];

type GetChildrenCanBeEmpty<T, R> = (value: T) => R[] | undefined;

type TransformFunctionType<T, C, R> = (value: T, children: C[]) => R;

type MatchConditionType<T> = (value: T) => boolean;

type TransformToSearchableProps<T, C, TR, CR, P> = {
  getChildren: GetChildrenType<T, C>;
  transformType: TransformFunctionType<T, CR, TR>;
  actions?: (parent: P, data: T) => void;
};

type TreeFilterPropsParent<T, C> = {
  data: T[];
  matchCondition: MatchConditionType<T>;
  getChildren: GetChildrenType<T, C>;
  childrenProps: {
    matchCondition: MatchConditionType<C>;
    getChildren: GetChildrenCanBeEmpty<C, C>;
  };
};

type TreeFilterProps<T> = {
  data: T[];
  matchCondition: MatchConditionType<T>;
  getChildren: GetChildrenCanBeEmpty<T, T>;
};

export const toLower = (data?: string) => {
  return data?.toLowerCase() ?? '';
};

export const isValueIncludesSearchString = (
  value?: string,
  searchString?: string
) => {
  return toLower(value).includes(toLower(searchString));
};

export function isEmptyList<T>(value?: T[]) {
  if (!value) return true;
  if (value.length > 0) return false;
  return true;
}

export function transformParentObject<T, C, TR, CR>(
  data: T[],
  props: TransformToSearchableProps<T, C, TR, CR, T> & {
    childProps: TransformToSearchableProps<C, C, CR, CR, T>;
  }
): TR[] {
  const {
    getChildren: getChildrenMaster,
    transformType: transformTypeMaster,
    childProps,
  } = props;

  const node: TR[] = [];
  data.forEach((value) => {
    const children = getChildrenMaster(value);
    const transformedObject = transformObject<C, CR, T>(value, children, childProps);
    const obj = transformTypeMaster(value, transformedObject);
    node.push(obj);
  });
  return node;
}

const transformObject = <T, R, P>(
  parent: P,
  data: T[],
  props: TransformToSearchableProps<T, T, R, R, P>
): R[] => {
  const { getChildren, transformType, actions } = props;
  const node: R[] = [];
  data.forEach((value) => {
    if (actions) actions(parent, value);
    const children = getChildren(value);
    const obj = transformType(value, transformObject(parent, children, props));
    node.push(obj);
  });
  return node;
};

export function filterGenericParent<T, C>(props: TreeFilterPropsParent<T, C>) {
  const {
    data,
    getChildren: getChildrenMaster,
    matchCondition: matchConditionMaster,
    childrenProps,
  } = props;
  const result: T[] = [];
  data.forEach((at) => {
    const children = getChildrenMaster(at);
    const matches = matchConditionMaster(at);
    if (matches) {
      result.push({ ...at, children: children ?? undefined });
    } else {
      const filteredChildren = filterGeneric<C>({
        data: children,
        ...childrenProps,
      });
      if (children && !isEmptyList(filteredChildren))
        result.push({ ...at, children: filteredChildren });
    }
  });
  return result;
}

export const filterGeneric = <T>(props: TreeFilterProps<T>) => {
  const { data, matchCondition, getChildren } = props;
  const nodes: T[] = [];
  data.forEach((value) => {
    const children = getChildren(value);
    const matches = matchCondition(value);
    if (matches) {
      nodes.push({ ...value, children: children ?? undefined });
    } else {
      const filteredChildren =
        children && filterGeneric({ ...props, data: children });
      if (children && !isEmptyList(filteredChildren)) {
        nodes.push({ ...value, children: filteredChildren });
      }
    }
  });
  return nodes;
};
