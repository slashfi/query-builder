import type { AstNodeRepository } from './ast-node-repository';
import type { AstNode } from './base';

export function createAstNode<Node extends AstNode>() {
  return <Params extends Omit<AstNodeRepository<Node>, 'isNode'>>(
    options: Params
  ): Params & {
    isNode(value: AstNode): value is Node;
  } => {
    return {
      ...options,
      isNode: (value): value is Node => {
        return (
          value.class === options.class &&
          value.variant === options.variant &&
          value.type === options.type
        );
      },
    };
  };
}
