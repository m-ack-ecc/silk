import { clickWrapperElement, findAll } from "../../TestHelper";
import { ReactWrapper } from "enzyme";

/** Clicks the "next" button of a paging element.
 *
 * @param wrapper The element the paging component is contained in.
 */
export const clickNextPageButton = (wrapper: ReactWrapper<any, any>) => {
    const navButtons = findAll(wrapper, ".bx--pagination__right button");
    expect(navButtons).toHaveLength(2);
    clickWrapperElement(navButtons[1]);
};
