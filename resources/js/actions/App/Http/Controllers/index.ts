import RoadController from './RoadController'
import LguController from './LguController'
import EngineerController from './EngineerController'
import MaintenanceProjectController from './MaintenanceProjectController'
import MonthlyUpdateController from './MonthlyUpdateController'
import ProjectDocumentController from './ProjectDocumentController'
import UpdatesMediaController from './UpdatesMediaController'
import UserAccountController from './UserAccountController'
import Settings from './Settings'

const Controllers = {
    RoadController: Object.assign(RoadController, RoadController),
    LguController: Object.assign(LguController, LguController),
    EngineerController: Object.assign(EngineerController, EngineerController),
    MaintenanceProjectController: Object.assign(MaintenanceProjectController, MaintenanceProjectController),
    MonthlyUpdateController: Object.assign(MonthlyUpdateController, MonthlyUpdateController),
    ProjectDocumentController: Object.assign(ProjectDocumentController, ProjectDocumentController),
    UpdatesMediaController: Object.assign(UpdatesMediaController, UpdatesMediaController),
    UserAccountController: Object.assign(UserAccountController, UserAccountController),
    Settings: Object.assign(Settings, Settings),
}

export default Controllers