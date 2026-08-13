import React from "react";
import PropTypes from "prop-types";

import AccountBalanceIcon from "@mui/icons-material/AccountBalance";
import AccountTreeIcon from "@mui/icons-material/AccountTree";
import AddIcon from "@mui/icons-material/Add";
import ApartmentIcon from "@mui/icons-material/Apartment";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import ArrowDropUpIcon from "@mui/icons-material/ArrowDropUp";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import AssignmentTurnedInIcon from "@mui/icons-material/AssignmentTurnedIn";
import BadgeIcon from "@mui/icons-material/Badge";
import BoltIcon from "@mui/icons-material/Bolt";
import CalculateIcon from "@mui/icons-material/Calculate";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import CancelIcon from "@mui/icons-material/Cancel";
import CategoryIcon from "@mui/icons-material/Category";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import CloseIcon from "@mui/icons-material/Close";
import CottageIcon from "@mui/icons-material/Cottage";
import CreditCardIcon from "@mui/icons-material/CreditCard";
import DashboardIcon from "@mui/icons-material/Dashboard";
import DateRangeIcon from "@mui/icons-material/DateRange";
import DeleteIcon from "@mui/icons-material/Delete";
import DescriptionIcon from "@mui/icons-material/Description";
import DoneIcon from "@mui/icons-material/Done";
import EditIcon from "@mui/icons-material/Edit";
import EmailIcon from "@mui/icons-material/Email";
import EventIcon from "@mui/icons-material/Event";
import EventAvailableIcon from "@mui/icons-material/EventAvailable";
import EventNoteIcon from "@mui/icons-material/EventNote";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import FactCheckIcon from "@mui/icons-material/FactCheck";
import FingerprintIcon from "@mui/icons-material/Fingerprint";
import FlagIcon from "@mui/icons-material/Flag";
import GavelIcon from "@mui/icons-material/Gavel";
import GridViewIcon from "@mui/icons-material/GridView";
import GroupIcon from "@mui/icons-material/Group";
import GroupsIcon from "@mui/icons-material/Groups";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import HistoryIcon from "@mui/icons-material/History";
import HomeIcon from "@mui/icons-material/Home";
import ImageIcon from "@mui/icons-material/Image";
import LockOpenIcon from "@mui/icons-material/LockOpen";
import LockResetIcon from "@mui/icons-material/LockReset";
import LockIcon from "@mui/icons-material/Lock";
import LoginIcon from "@mui/icons-material/Login";
import LocationCityIcon from "@mui/icons-material/LocationCity";
import LogoutIcon from "@mui/icons-material/Logout";
import ManageAccountsIcon from "@mui/icons-material/ManageAccounts";
import MenuIcon from "@mui/icons-material/Menu";
import MenuOpenIcon from "@mui/icons-material/MenuOpen";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import NotificationsIcon from "@mui/icons-material/Notifications";
import PaidIcon from "@mui/icons-material/Paid";
import PaymentsIcon from "@mui/icons-material/Payments";
import PercentIcon from "@mui/icons-material/Percent";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import PersonIcon from "@mui/icons-material/Person";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import PublicIcon from "@mui/icons-material/Public";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import RequestQuoteIcon from "@mui/icons-material/RequestQuote";
import RuleIcon from "@mui/icons-material/Rule";
import SavingsIcon from "@mui/icons-material/Savings";
import ScheduleIcon from "@mui/icons-material/Schedule";
import SearchIcon from "@mui/icons-material/Search";
import SettingsIcon from "@mui/icons-material/Settings";
import ShieldIcon from "@mui/icons-material/Shield";
import TodayIcon from "@mui/icons-material/Today";
import ToggleOffIcon from "@mui/icons-material/ToggleOff";
import ToggleOnIcon from "@mui/icons-material/ToggleOn";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import TuneIcon from "@mui/icons-material/Tune";
import VerifiedIcon from "@mui/icons-material/Verified";
import VerifiedUserIcon from "@mui/icons-material/VerifiedUser";
import VisibilityIcon from "@mui/icons-material/Visibility";
import WifiIcon from "@mui/icons-material/Wifi";
import WorkspacePremiumIcon from "@mui/icons-material/WorkspacePremium";

const ICON_MAP = {
  account_balance: AccountBalanceIcon,
  account_tree: AccountTreeIcon,
  add: AddIcon,
  apartment: ApartmentIcon,
  arrow_back: ArrowBackIcon,
  arrow_drop_down: ArrowDropDownIcon,
  arrow_drop_up: ArrowDropUpIcon,
  arrow_upward: ArrowUpwardIcon,
  assignment_turned_in: AssignmentTurnedInIcon,
  badge: BadgeIcon,
  bolt: BoltIcon,
  calculate: CalculateIcon,
  calendar_month: CalendarMonthIcon,
  calendar_today: CalendarTodayIcon,
  cancel: CancelIcon,
  category: CategoryIcon,
  check_circle: CheckCircleIcon,
  chevron_left: ChevronLeftIcon,
  chevron_right: ChevronRightIcon,
  close: CloseIcon,
  cottage: CottageIcon,
  credit_card: CreditCardIcon,
  dashboard: DashboardIcon,
  date_range: DateRangeIcon,
  delete: DeleteIcon,
  description: DescriptionIcon,
  done: DoneIcon,
  edit: EditIcon,
  email: EmailIcon,
  event: EventIcon,
  event_available: EventAvailableIcon,
  event_note: EventNoteIcon,
  expand_more: ExpandMoreIcon,
  fact_check: FactCheckIcon,
  fingerprint: FingerprintIcon,
  flag: FlagIcon,
  gavel: GavelIcon,
  grid_view: GridViewIcon,
  group: GroupIcon,
  groups: GroupsIcon,
  history: HistoryIcon,
  home: HomeIcon,
  image: ImageIcon,
  location_city: LocationCityIcon,
  lock: LockIcon,
  lock_open: LockOpenIcon,
  lock_reset: LockResetIcon,
  login: LoginIcon,
  logout: LogoutIcon,
  manage_accounts: ManageAccountsIcon,
  menu: MenuIcon,
  menu_open: MenuOpenIcon,
  more_vert: MoreVertIcon,
  notifications: NotificationsIcon,
  paid: PaidIcon,
  payments: PaymentsIcon,
  percent: PercentIcon,
  person: PersonIcon,
  person_add: PersonAddIcon,
  picture_as_pdf: PictureAsPdfIcon,
  public: PublicIcon,
  receipt_long: ReceiptLongIcon,
  request_quote: RequestQuoteIcon,
  rule: RuleIcon,
  savings: SavingsIcon,
  schedule: ScheduleIcon,
  search: SearchIcon,
  settings: SettingsIcon,
  shield: ShieldIcon,
  today: TodayIcon,
  toggle_off: ToggleOffIcon,
  toggle_on: ToggleOnIcon,
  trending_up: TrendingUpIcon,
  tune: TuneIcon,
  verified: VerifiedIcon,
  verified_user: VerifiedUserIcon,
  visibility: VisibilityIcon,
  wifi: WifiIcon,
  workspace_premium: WorkspacePremiumIcon,
};

function normalizeFontSize(fontSize) {
  if (fontSize === "default") return "medium";
  if (["inherit", "small", "medium", "large"].includes(fontSize)) return fontSize;
  return "medium";
}

function AppIcon({ children, fontSize, ...rest }) {
  if (React.isValidElement(children)) {
    return children;
  }

  const iconName = typeof children === "string" ? children.trim() : children;
  const IconComponent = ICON_MAP[iconName] || HelpOutlineIcon;

  return <IconComponent fontSize={normalizeFontSize(fontSize)} {...rest} />;
}

AppIcon.defaultProps = {
  children: "",
  fontSize: "medium",
};

AppIcon.propTypes = {
  children: PropTypes.node,
  fontSize: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
};

export default AppIcon;
