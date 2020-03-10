import React, { useEffect, useState } from "react";
import Card from "../../../../../wrappers/blueprint/card";
import { useDispatch, useSelector } from "react-redux";
import { workspaceOp, workspaceSel } from "@ducks/workspace";
import { Intent } from "@wrappers/blueprint/constants";
import { Icon } from "@wrappers/index";
import MarkdownModal from "../../../../components/modals/MarkdownModal";
import { AppToaster } from "../../../../../services/toaster";
import Loading from "../Configuration";

const ConfigurationWidget = () => {
    const dispatch = useDispatch();
    const projectId = useSelector(workspaceSel.currentProjectIdSelector);
    const warningList = useSelector(workspaceSel.warningListSelector);

    const warnWidget = useSelector(workspaceSel.widgetsSelector).warnings;
    const {error, isLoading} = warnWidget;

    const [currentMarkdown, setCurrentMarkdown] = useState('');
    const [isOpen, setIsOpen] = useState<boolean>(false);

    useEffect(() => {
        getWarningList();
    }, []);

    const handleOpen = () => setIsOpen(true);
    const handleClose = () => {
        setCurrentMarkdown('');
        setIsOpen(false);
    };

    const getWarningList = () => {
        dispatch(workspaceOp.fetchWarningListAsync());
    };

    const handleOpenMarkDown = async (taskId) => {
        try {
            const markdown: string = await workspaceOp.fetchWarningMarkdownAsync(projectId, taskId);
            handleOpen();
            setCurrentMarkdown(markdown);
        } catch {
            AppToaster.show({
                message: `Sorry but we can't find the markdown information for this report`,
                intent: Intent.DANGER,
                timeout: 2000
            });
        }
    };

    return (
        <Card>
            <h3>Warning</h3>
            {
                isLoading ? <Loading/> :
                    <div>
                        {
                            warningList.map(warn =>
                                <div>
                                    {warn.errorSummary}
                                    <Icon name="item-info" onClick={() => handleOpenMarkDown(warn.taskId)}/>
                                </div>
                            )
                        }
                        <MarkdownModal isOpen={isOpen} onDiscard={handleClose} markdown={currentMarkdown}/>
                    </div>
            }
        </Card>
    )
};

export default ConfigurationWidget;
