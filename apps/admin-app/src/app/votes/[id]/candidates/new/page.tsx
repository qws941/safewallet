import ClientPage from "./add-candidate";

export function generateStaticParams() {
  return [{ id: "__placeholder" }];
}

export default function Page() {
  return <ClientPage />;
}
